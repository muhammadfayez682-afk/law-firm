import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake } from "@/lib/intake";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({
    where: { id },
    include: {
      receivedBy: { select: { fullName: true } },
      assessmentBy: { select: { fullName: true } },
      decisionBy: { select: { fullName: true } },
      case: { select: { id: true, internalNumber: true } },
      documents: { include: { uploadedBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      notes: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!canAccessIntake(session.user, intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذا الطلب" }, { status: 403 });
  }

  return NextResponse.json(intake);
}

/** تحديث خفيف حسب المرحلة (مثل إلغاء الطلب أو تحديث بيانات أولية). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!canAccessIntake(session.user, intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذا الطلب" }, { status: 403 });
  }

  const body = await request.json();
  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      clientEmail: body.clientEmail !== undefined ? body.clientEmail?.trim() || null : undefined,
      referredBy: body.referredBy !== undefined ? body.referredBy?.trim() || null : undefined,
      advancePaymentReceived:
        body.advancePaymentReceived !== undefined ? Boolean(body.advancePaymentReceived) : undefined,
      feeAgreementSignedAt:
        body.feeAgreementSignedAt !== undefined
          ? body.feeAgreementSignedAt
            ? new Date(body.feeAgreementSignedAt)
            : null
          : undefined,
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

  return NextResponse.json(updated);
}
