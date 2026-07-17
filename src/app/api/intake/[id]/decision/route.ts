import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { RejectionReason } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDecideIntake, REJECTION_REASON_LABELS_AR } from "@/lib/intake";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** قرار القبول/الرفض — مسؤول النظام فقط. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canDecideIntake(session.user.role)) {
    return NextResponse.json({ error: "قرار القبول/الرفض متاح لمسؤول النظام أو المشرف" }, { status: 403 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (intake.status === "accepted") {
    return NextResponse.json({ error: "الطلب مقبول ومُفعَّل بالفعل" }, { status: 400 });
  }

  const body = await request.json();
  const decision = body.decision;

  if (decision !== "accepted" && decision !== "rejected") {
    return NextResponse.json({ error: "قرار غير صالح" }, { status: 400 });
  }

  if (decision === "rejected") {
    const reason = body.reason as RejectionReason;
    if (!reason || !(reason in REJECTION_REASON_LABELS_AR)) {
      return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 });
    }
    const updated = await prisma.intakeRequest.update({
      where: { id },
      data: {
        decision: "rejected",
        decisionById: session.user.id,
        decisionAt: new Date(),
        rejectionReason: reason,
        rejectionNotes: body.notes?.trim() || null,
        status: "rejected",
      },
    });
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "update", resourceType: "IntakeRequest", resourceId: id },
    });
    if (intake.receivedById !== session.user.id) {
      await notify({
        recipientId: intake.receivedById,
        type: "intake_rejected",
        priority: "normal",
        title: "رُفض طلب استلام",
        message: `رُفض طلب الاستلام ${intake.requestNumber}.`,
        actionUrl: `/intake/${id}`,
        resourceType: "IntakeRequest",
        resourceId: id,
        triggeredById: session.user.id,
      });
    }
    return NextResponse.json(updated);
  }

  // قبول: ينتقل الطلب لمرحلة توقيع عقد الأتعاب (التفعيل لاحقًا).
  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      decision: "accepted",
      decisionById: session.user.id,
      decisionAt: new Date(),
      status: "fee_agreement_pending",
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "IntakeRequest", resourceId: id },
  });
  if (intake.receivedById !== session.user.id) {
    await notify({
      recipientId: intake.receivedById,
      type: "intake_accepted",
      priority: "normal",
      title: "قُبل طلب استلام",
      message: `قُبل طلب الاستلام ${intake.requestNumber} وانتقل لمرحلة عقد الأتعاب.`,
      actionUrl: `/intake/${id}`,
      resourceType: "IntakeRequest",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }
  return NextResponse.json(updated);
}
