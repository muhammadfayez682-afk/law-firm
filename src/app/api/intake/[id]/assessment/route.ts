import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake, assessmentMissingFields } from "@/lib/intake";
import { notifyBulk } from "@/lib/notifications/send";
import { getUserIdsByRoles } from "@/lib/notifications/recipients";

type Params = { params: Promise<{ id: string }> };

/** حفظ دراسة التقييم — متاح لأي مستخدم يملك رؤية الطلب (تعبئة، لا اعتماد). */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

  if (!canAccessIntake(session.user, intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية تقييم هذا الطلب" }, { status: 403 });
  }

  const body = await request.json();

  const nextData = {
    legalBasis: body.legalBasis?.trim() || null,
    strengths: body.strengths?.trim() || null,
    weaknesses: body.weaknesses?.trim() || null,
    jurisdiction: body.jurisdiction?.trim() || null,
    estimatedDuration: body.estimatedDuration?.trim() || null,
    proposedFee:
      body.proposedFee !== undefined && body.proposedFee !== null && body.proposedFee !== ""
        ? Number(body.proposedFee)
        : null,
  };

  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      ...nextData,
      assessmentById: session.user.id,
      assessedAt: new Date(),
      // أي تعديل على الدراسة يُلغي اعتمادًا سابقًا (يتطلب إعادة اعتماد).
      assessmentApprovedById: null,
      assessmentApprovedAt: null,
      // ننقل الحالة إلى قيد التقييم إن لم تكن قد تجاوزتها.
      status: intake.status === "rejected" || intake.status === "accepted"
        ? undefined
        : "under_assessment",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "IntakeRequest",
      resourceId: id,
    },
  });

  // اكتمال الحقول الأربعة الإلزامية → التقييم جاهز للاعتماد → إشعار مسؤولي النظام.
  if (assessmentMissingFields(nextData).length === 0) {
    const adminIds = (await getUserIdsByRoles(["system_admin"])).filter((uid) => uid !== session.user.id);
    await notifyBulk(adminIds, {
      type: "intake_assessment_ready",
      priority: "normal",
      title: "تقييم بانتظار الاعتماد",
      message: `اكتمل تقييم الطلب ${intake.requestNumber} وينتظر اعتماد المسؤول.`,
      actionUrl: `/intake/${id}`,
      resourceType: "IntakeRequest",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json(updated);
}
