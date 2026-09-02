import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { casePermissionInclude } from "@/lib/rbac";
import { canWriteVerdict, isVerdictDegree, isVerdictResult, VERDICT_DEGREE_LABELS_AR } from "@/lib/verdicts";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string; verdictId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, verdictId } = await params;
  const caseData = await prisma.case.findUnique({ where: { id }, include: casePermissionInclude });
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canWriteVerdict(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل صكوك هذه القضية" }, { status: 403 });
  }

  const verdict = await prisma.verdict.findFirst({ where: { id: verdictId, caseId: id } });
  if (!verdict) return NextResponse.json({ error: "الصك غير موجود" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const caseNo = caseData.displayNumber ?? caseData.internalNumber;

  // تأكيد اكتساب القطعية يدويًا.
  if (body.confirmFinality === true) {
    if (verdict.finality === "final_binding") {
      return NextResponse.json({ error: "الصك مكتسب القطعية بالفعل" }, { status: 400 });
    }
    const updated = await prisma.verdict.update({
      where: { id: verdictId },
      data: { finality: "final_binding", finalityConfirmedById: session.user.id, finalityConfirmedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "update", resourceType: "Verdict", resourceId: verdictId },
    });
    const recipients = [caseData.responsibleLawyerId, ...caseData.team.map((m) => m.userId)].filter(
      (uid) => uid !== session.user.id
    );
    await notifyBulk(recipients, {
      type: "finality_confirmed",
      priority: "normal",
      title: "اكتسب الحكم القطعية",
      message: `تأكّد اكتساب حكم ${VERDICT_DEGREE_LABELS_AR[verdict.degree]} في القضية ${caseNo} القطعية.`,
      actionUrl: `/cases/${id}`,
      resourceType: "case",
      resourceId: id,
      triggeredById: session.user.id,
    });
    return NextResponse.json({ ok: true, finality: updated.finality });
  }

  // تعديل بيانات الصك.
  const data: Record<string, unknown> = {};
  if (body.degree !== undefined) {
    if (!isVerdictDegree(body.degree)) return NextResponse.json({ error: "درجة الحكم غير صالحة" }, { status: 400 });
    data.degree = body.degree;
  }
  if (body.result !== undefined) {
    if (!isVerdictResult(body.result)) return NextResponse.json({ error: "نتيجة الحكم غير صالحة" }, { status: 400 });
    data.result = body.result;
  }
  if (body.verdictNumber !== undefined) {
    const n = String(body.verdictNumber).trim();
    if (!n) return NextResponse.json({ error: "رقم الصك مطلوب" }, { status: 400 });
    data.verdictNumber = n;
  }
  if (body.verdictDate !== undefined) {
    const d = new Date(String(body.verdictDate));
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "تاريخ الصك غير صالح" }, { status: 400 });
    data.verdictDate = d;
  }
  if (body.ruling !== undefined) {
    const r = String(body.ruling).trim();
    if (!r) return NextResponse.json({ error: "منطوق الحكم مطلوب" }, { status: 400 });
    data.ruling = r;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "لا توجد تغييرات" }, { status: 400 });
  }

  const updated = await prisma.verdict.update({ where: { id: verdictId }, data });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Verdict", resourceId: verdictId },
  });
  return NextResponse.json({ ok: true, id: updated.id });
}
