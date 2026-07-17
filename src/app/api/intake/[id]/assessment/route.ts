import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAssessIntake } from "@/lib/intake";
import { notifyBulk } from "@/lib/notifications/send";
import { getUserIdsByRoles } from "@/lib/notifications/recipients";

type Params = { params: Promise<{ id: string }> };

/** حفظ دراسة التقييم — مسؤول النظام فقط. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

  if (!canAssessIntake(session.user, intake)) {
    return NextResponse.json(
      { error: "دراسة التقييم متاحة لمسؤول النظام أو المشرف أو المُفوَّض إليه" },
      { status: 403 }
    );
  }

  const body = await request.json();

  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      legalBasis: body.legalBasis?.trim() || null,
      strengths: body.strengths?.trim() || null,
      weaknesses: body.weaknesses?.trim() || null,
      jurisdiction: body.jurisdiction?.trim() || null,
      estimatedDuration: body.estimatedDuration?.trim() || null,
      proposedFee:
        body.proposedFee !== undefined && body.proposedFee !== null && body.proposedFee !== ""
          ? Number(body.proposedFee)
          : null,
      assessmentById: session.user.id,
      assessedAt: new Date(),
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

  // اكتمل التقييم → إشعار مسؤولي النظام والمشرفين لاتخاذ القرار.
  const deciderIds = (await getUserIdsByRoles(["system_admin", "supervisor"])).filter(
    (uid) => uid !== session.user.id
  );
  await notifyBulk(deciderIds, {
    type: "intake_pending_decision",
    priority: "normal",
    title: "طلب بانتظار القرار",
    message: `اكتمل تقييم الطلب ${intake.requestNumber} وينتظر قرار القبول/الرفض.`,
    actionUrl: `/intake/${id}`,
    resourceType: "IntakeRequest",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(updated);
}
