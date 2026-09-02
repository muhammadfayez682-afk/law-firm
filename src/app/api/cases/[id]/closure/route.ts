import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/rbac";
import {
  CASE_ACTIVE_STATUS_AFTER_REJECTION,
  CASE_OUTCOME_LABELS_AR,
  canRequestCaseClosure,
  canTransitionToPendingClosure,
} from "@/lib/caseClosure";
import {
  isCaseClosureReason,
  closureRequirementError,
  mapClosureReasonToOld,
  type ClosureRequirementContext,
} from "@/lib/verdicts";
import { notify, notifyBulk } from "@/lib/notifications/send";
import { getUserIdsByRoles } from "@/lib/notifications/recipients";

/** سياق متطلّب الإغلاق من بيانات القضية (صكوك + تسوية). */
function closureContext(caseData: {
  verdicts: { finality: string }[];
  amicableSettlement: { outcome: string } | null;
}): ClosureRequirementContext {
  return {
    hasFinalBindingVerdict: caseData.verdicts.some((v) => v.finality === "final_binding"),
    hasSettledSettlement: caseData.amicableSettlement?.outcome === "settled",
  };
}

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    include: { team: true, verdicts: { select: { finality: true } }, amicableSettlement: { select: { outcome: true } } },
  });

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canRequestCaseClosure(session.user.id, caseData)) {
    return NextResponse.json(
      { error: "لا تملك صلاحية طلب إغلاق هذه القضية — يجب أن تكون المحامي المسؤول أو ضمن فريق القضية" },
      { status: 403 }
    );
  }

  if (!canTransitionToPendingClosure(caseData.status)) {
    return NextResponse.json(
      { error: "لا يمكن طلب إغلاق هذه القضية في حالتها الحالية" },
      { status: 400 }
    );
  }

  const body = await request.json();
  // تحقق أساسي: النتيجة + سبب الإغلاق المتعدد + الملخص.
  if (typeof body.outcome !== "string" || !(body.outcome in CASE_OUTCOME_LABELS_AR)) {
    return NextResponse.json({ error: "نتيجة القضية مطلوبة" }, { status: 400 });
  }
  if (!isCaseClosureReason(body.closureReason)) {
    return NextResponse.json({ error: "سبب الإغلاق مطلوب" }, { status: 400 });
  }
  const closureNote = typeof body.closureNotes === "string" ? body.closureNotes.trim() : "";
  if (!closureNote) {
    return NextResponse.json({ error: "ملخص النتيجة مطلوب" }, { status: 400 });
  }
  // متطلّب سبب الإغلاق (verdict يتطلب صكًا مكتسب القطعية، إلخ) — مفروض على الـ API.
  const reqError = closureRequirementError(body.closureReason, closureNote, closureContext(caseData));
  if (reqError) {
    return NextResponse.json({ error: reqError }, { status: 400 });
  }

  const [closureRequest] = await prisma.$transaction([
    prisma.caseClosureRequest.upsert({
      where: { caseId: id },
      update: {
        outcome: body.outcome,
        closureReason: mapClosureReasonToOld(body.closureReason),
        closureNotes: closureNote,
        requestedById: session.user.id,
        requestedAt: new Date(),
        status: "pending_approval",
        approvedById: null,
        approvedAt: null,
        rejectionNote: null,
      },
      create: {
        caseId: id,
        outcome: body.outcome,
        closureReason: mapClosureReasonToOld(body.closureReason),
        closureNotes: closureNote,
        requestedById: session.user.id,
      },
    }),
    prisma.case.update({
      where: { id },
      data: { status: "pending_closure", closureReason: body.closureReason, closureNote },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "create",
        resourceType: "CaseClosureRequest",
        resourceId: id,
      },
    }),
  ]);

  // إشعار مسؤولي النظام بطلب إغلاق ينتظر الاعتماد.
  await notifyBulk(await getUserIdsByRoles(["system_admin"]), {
    type: "case_closure_requested",
    priority: "high",
    title: "طلب إغلاق قضية",
    message: `طُلب إغلاق القضية «${caseData.title}» (${caseData.internalNumber}) وينتظر اعتمادك.`,
    actionUrl: `/cases/${id}`,
    resourceType: "Case",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(closureRequest, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "اعتماد أو رفض إغلاق القضية صلاحية حصرية لمسؤول النظام" }, { status: 403 });
  }

  const { id } = await params;

  const closureRequest = await prisma.caseClosureRequest.findUnique({
    where: { caseId: id },
    include: {
      case: {
        select: {
          title: true,
          internalNumber: true,
          displayNumber: true,
          responsibleLawyerId: true,
          closureReason: true,
          team: { select: { userId: true } },
          verdicts: { select: { finality: true } },
          amicableSettlement: { select: { outcome: true } },
        },
      },
    },
  });
  if (!closureRequest || closureRequest.status !== "pending_approval") {
    return NextResponse.json({ error: "لا يوجد طلب إغلاق قيد الانتظار لهذه القضية" }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
  }

  if (action === "reject" && (typeof body.rejectionNote !== "string" || !body.rejectionNote.trim())) {
    return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 });
  }

  // إعادة التحقق من متطلّب الإغلاق عند الاعتماد (قد يتغيّر الوضع بين الطلب والاعتماد).
  if (action === "approve" && closureRequest.case.closureReason) {
    const reqError = closureRequirementError(
      closureRequest.case.closureReason,
      closureRequest.closureNotes,
      closureContext(closureRequest.case)
    );
    if (reqError) return NextResponse.json({ error: reqError }, { status: 400 });
  }

  const now = new Date();

  const [updatedRequest, updatedCase] = await prisma.$transaction([
    prisma.caseClosureRequest.update({
      where: { caseId: id },
      data:
        action === "approve"
          ? { status: "approved", approvedById: session.user.id, approvedAt: now }
          : {
              status: "rejected",
              approvedById: session.user.id,
              approvedAt: now,
              rejectionNote: body.rejectionNote.trim(),
            },
    }),
    prisma.case.update({
      where: { id },
      data:
        action === "approve"
          ? { status: "closed", closedDate: now, outcome: closureRequest.outcome, closedById: session.user.id, closedAt: now }
          : { status: CASE_ACTIVE_STATUS_AFTER_REJECTION },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "update",
        resourceType: "CaseClosureRequest",
        resourceId: id,
      },
    }),
  ]);

  // إشعار طالب الإغلاق (المحامي المسؤول) بنتيجة الاعتماد.
  if (closureRequest.requestedById !== session.user.id) {
    await notify({
      recipientId: closureRequest.requestedById,
      type: action === "approve" ? "case_closure_approved" : "case_closure_rejected",
      priority: action === "approve" ? "normal" : "high",
      title: action === "approve" ? "اعتُمد إغلاق القضية" : "رُفض طلب إغلاق القضية",
      message:
        action === "approve"
          ? `اعتُمد إغلاق القضية «${closureRequest.case.title}» (${closureRequest.case.internalNumber}).`
          : `رُفض طلب إغلاق القضية «${closureRequest.case.title}»: ${body.rejectionNote.trim()}`,
      actionUrl: `/cases/${id}`,
      resourceType: "Case",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  // إشعار فريق القضية بإغلاقها فعليًا.
  if (action === "approve") {
    const teamIds = [
      closureRequest.case.responsibleLawyerId,
      ...closureRequest.case.team.map((m) => m.userId),
    ].filter((uid) => uid !== session.user.id && uid !== closureRequest.requestedById);
    await notifyBulk(teamIds, {
      type: "case_closed",
      priority: "normal",
      title: "أُغلقت القضية",
      message: `أُغلقت القضية «${closureRequest.case.title}» (${closureRequest.case.displayNumber ?? closureRequest.case.internalNumber}).`,
      actionUrl: `/cases/${id}`,
      resourceType: "case",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ closureRequest: updatedRequest, case: updatedCase });
}
