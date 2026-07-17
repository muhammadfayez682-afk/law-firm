import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDelegateAssessment } from "@/lib/intake";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** تفويض دراسة التقييم لموظف آخر — مسؤول النظام أو المشرف. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  if (!canDelegateAssessment(session.user.role)) {
    return NextResponse.json({ error: "التفويض متاح لمسؤول النظام أو المشرف" }, { status: 403 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (intake.status === "accepted" || intake.status === "rejected") {
    return NextResponse.json({ error: "لا يمكن تفويض تقييم طلب مُغلق" }, { status: 400 });
  }

  const body = await request.json();
  const delegateToId = typeof body.delegateToId === "string" ? body.delegateToId : "";
  if (!delegateToId) return NextResponse.json({ error: "يجب اختيار الموظف المُفوَّض" }, { status: 400 });

  const delegate = await prisma.user.findUnique({
    where: { id: delegateToId },
    select: { id: true, isActive: true, role: true },
  });
  if (!delegate || !delegate.isActive) {
    return NextResponse.json({ error: "الموظف غير صالح" }, { status: 400 });
  }
  if (delegate.role === "secretary" || delegate.role === "accountant") {
    return NextResponse.json({ error: "لا يمكن تفويض التقييم لهذا الدور" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";

  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      assessmentDelegatedToId: delegateToId,
      assessmentDelegatedById: session.user.id,
      assessmentDelegatedAt: new Date(),
      // تُنقل الحالة إلى «قيد التقييم» إن لم تتجاوزها بعد.
      status: intake.status === "received" || intake.status === "conflict_check"
        ? "under_assessment"
        : undefined,
      ...(note
        ? { notes: { create: { content: `تفويض التقييم: ${note}`, authorId: session.user.id } } }
        : {}),
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "IntakeRequest", resourceId: id },
  });

  await notify({
    recipientId: delegateToId,
    type: "intake_assessment_delegated",
    priority: "high",
    title: "فُوِّض إليك تقييم طلب",
    message: `فُوِّض إليك تقييم طلب الاستلام ${intake.requestNumber}.`,
    actionUrl: `/intake/${id}`,
    resourceType: "IntakeRequest",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(updated);
}

/** إلغاء التفويض — المُفوِّض الأصلي أو مسؤول النظام. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!intake.assessmentDelegatedToId) {
    return NextResponse.json({ error: "لا يوجد تفويض حالي" }, { status: 400 });
  }

  const isDelegator = intake.assessmentDelegatedById === session.user.id;
  if (!isDelegator && session.user.role !== "system_admin") {
    return NextResponse.json({ error: "إلغاء التفويض متاح للمُفوِّض أو مسؤول النظام" }, { status: 403 });
  }

  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      assessmentDelegatedToId: null,
      assessmentDelegatedById: null,
      assessmentDelegatedAt: null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "IntakeRequest", resourceId: id },
  });

  return NextResponse.json(updated);
}
