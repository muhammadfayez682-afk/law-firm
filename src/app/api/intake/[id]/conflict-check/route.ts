import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake } from "@/lib/intake";
import { checkConflictOfInterest } from "@/lib/conflictCheck";

type Params = { params: Promise<{ id: string }> };

/** إعادة فحص تعارض المصالح لطلب استلام. */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!canAccessIntake(session.user, intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية على هذا الطلب" }, { status: 403 });
  }

  const conflict = await checkConflictOfInterest(intake.opposingParty ?? "");

  const updated = await prisma.intakeRequest.update({
    where: { id },
    data: {
      conflictResult: conflict.result,
      conflictNotes: conflict.details,
      conflictCheckedAt: new Date(),
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

  return NextResponse.json({ ...updated, conflict });
}
