import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, casePermissionInclude } from "@/lib/rbac";
import {
  canWriteVerdict,
  isVerdictDegree,
  isVerdictResult,
  VERDICT_DEGREE_LABELS_AR,
  VERDICT_RESULT_LABELS_AR,
} from "@/lib/verdicts";
import { uploadToR2, buildDocumentKey, isR2Configured } from "@/lib/r2";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

function loadCase(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: casePermissionInclude,
  });
}

function serialize(v: {
  id: string;
  degree: string;
  result: string;
  verdictNumber: string;
  verdictDate: Date;
  ruling: string;
  finality: string;
  finalityConfirmedAt: Date | null;
  attachmentKey: string | null;
  createdAt: Date;
  createdBy: { fullName: string };
}) {
  return {
    id: v.id,
    degree: v.degree,
    result: v.result,
    verdictNumber: v.verdictNumber,
    verdictDate: v.verdictDate.toISOString(),
    ruling: v.ruling,
    finality: v.finality,
    finalityConfirmedAt: v.finalityConfirmedAt?.toISOString() ?? null,
    hasAttachment: Boolean(v.attachmentKey),
    createdByName: v.createdBy.fullName,
    createdAt: v.createdAt.toISOString(),
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canAccessCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذه القضية" }, { status: 403 });
  }

  const verdicts = await prisma.verdict.findMany({
    where: { caseId: id },
    orderBy: [{ verdictDate: "asc" }, { createdAt: "asc" }],
    include: { createdBy: { select: { fullName: true } } },
  });

  return NextResponse.json({ verdicts: verdicts.map(serialize), canWrite: canWriteVerdict(session.user, caseData) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canWriteVerdict(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تسجيل صك حكم على هذه القضية" }, { status: 403 });
  }

  const form = await request.formData();
  const degree = form.get("degree");
  const result = form.get("result");
  const verdictNumber = (form.get("verdictNumber") as string | null)?.trim() || "";
  const verdictDateRaw = (form.get("verdictDate") as string | null)?.trim() || "";
  const ruling = (form.get("ruling") as string | null)?.trim() || "";
  const file = form.get("attachment") as File | null;

  if (!isVerdictDegree(degree)) return NextResponse.json({ error: "درجة الحكم مطلوبة" }, { status: 400 });
  if (!isVerdictResult(result)) return NextResponse.json({ error: "نتيجة الحكم مطلوبة" }, { status: 400 });
  if (!verdictNumber) return NextResponse.json({ error: "رقم الصك مطلوب" }, { status: 400 });
  const verdictDate = new Date(verdictDateRaw);
  if (!verdictDateRaw || Number.isNaN(verdictDate.getTime())) {
    return NextResponse.json({ error: "تاريخ الصك مطلوب" }, { status: 400 });
  }
  if (!ruling) return NextResponse.json({ error: "منطوق الحكم مطلوب" }, { status: 400 });

  // المرفق اختياري — رفع لـ R2 إن وُجد.
  let attachmentKey: string | null = null;
  if (file && file.size > 0) {
    if (!isR2Configured()) {
      return NextResponse.json({ error: "التخزين السحابي غير مهيأ لرفع المرفق (R2)" }, { status: 503 });
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachmentKey = await uploadToR2(buildDocumentKey("verdicts", id, file.name), buffer, file.type || undefined);
    } catch {
      return NextResponse.json({ error: "تعذّر رفع مرفق الصك" }, { status: 500 });
    }
  }

  const degreeLabel = VERDICT_DEGREE_LABELS_AR[degree];
  const resultLabel = VERDICT_RESULT_LABELS_AR[result];

  const verdict = await prisma.$transaction(async (tx) => {
    const created = await tx.verdict.create({
      data: {
        caseId: id,
        degree,
        result,
        verdictNumber,
        verdictDate,
        ruling,
        attachmentKey,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    // تسجيل الصك كحدث محوري في تسلسل أحداث القضية.
    const last = await tx.caseTimelineEvent.findFirst({
      where: { caseId: id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    await tx.caseTimelineEvent.create({
      data: {
        caseId: id,
        sequence: (last?.sequence ?? 0) + 1,
        title: `صك حكم ${degreeLabel} — ${resultLabel} (رقم ${verdictNumber})`,
        content: ruling,
        eventDate: verdictDate,
        source: "manual",
        createdById: session.user.id,
      },
    });

    await tx.auditLog.create({
      data: { userId: session.user.id, action: "create", resourceType: "Verdict", resourceId: created.id },
    });
    return created;
  });

  // إشعار فريق القضية بتسجيل الصك.
  const caseNo = caseData.displayNumber ?? caseData.internalNumber;
  const recipients = [caseData.responsibleLawyerId, ...caseData.team.map((m) => m.userId)].filter(
    (uid) => uid !== session.user.id
  );
  await notifyBulk(recipients, {
    type: "verdict_recorded",
    priority: "high",
    title: "سُجّل صك حكم",
    message: `سُجّل صك حكم ${degreeLabel} (${resultLabel}) على القضية ${caseNo}.`,
    actionUrl: `/cases/${id}`,
    resourceType: "case",
    resourceId: id,
    triggeredById: session.user.id,
  });

  // اقتراح إدخال مهلة الاستئناف عند حكم ابتدائي بلا مهلة مسجّلة.
  const suggestAppealDeadline = degree === "first_instance" && caseData.appealDeadline == null;

  return NextResponse.json({ verdict: serialize(verdict), suggestAppealDeadline }, { status: 201 });
}
