import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApproveAssessment, assessmentMissingFields } from "@/lib/intake";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/**
 * اعتماد دراسة التقييم — مسؤول النظام فقط.
 * بوّابة إلزامية للتفعيل: لا يُقبل الاعتماد قبل تعبئة الحقول الأربعة الإلزامية.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  if (!canApproveAssessment(session.user.role)) {
    return NextResponse.json({ error: "اعتماد التقييم متاح لمسؤول النظام فقط" }, { status: 403 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (intake.caseId) return NextResponse.json({ error: "الطلب مُفعَّل بالفعل" }, { status: 400 });
  if (intake.status === "rejected" || intake.status === "cancelled") {
    return NextResponse.json({ error: "لا يمكن اعتماد طلب مرفوض أو ملغى" }, { status: 400 });
  }
  if (intake.assessmentApprovedAt) {
    return NextResponse.json({ error: "التقييم معتمد بالفعل" }, { status: 400 });
  }

  // إجبار الحقول الأربعة الإلزامية (يعامل "0"/الفراغ كقيمة غير مقبولة).
  const missing = assessmentMissingFields(intake);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `لا يمكن اعتماد التقييم قبل تعبئة: ${missing.join("، ")}` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const approverNotes = typeof body.approverNotes === "string" ? body.approverNotes.trim() || null : null;

  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      assessmentApprovedById: session.user.id,
      assessmentApprovedAt: new Date(),
      approverNotes,
      // الاعتماد يجعل الطلب قابلًا للتفعيل (بانتظار عقد الأتعاب/التفعيل).
      status: "fee_agreement_pending",
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "IntakeRequest", resourceId: id },
  });

  // إشعار المقيّم باعتماد تقييمه.
  if (intake.assessmentById && intake.assessmentById !== session.user.id) {
    await notify({
      recipientId: intake.assessmentById,
      type: "intake_assessment_approved",
      priority: "normal",
      title: "تم اعتماد تقييمك",
      message: `اعتُمد تقييمك لطلب الاستلام ${intake.requestNumber}.`,
      actionUrl: `/intake/${id}`,
      resourceType: "IntakeRequest",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ ok: true, intake: updated });
}
