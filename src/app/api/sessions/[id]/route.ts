import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCase } from "@/lib/rbac";
import { toHijri } from "@/lib/dateUtils";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.session.findUnique({
    where: { id },
    include: { case: { include: { team: true, accessOverrides: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 });
  }

  if (!canEditCase(session.user, existing.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه الجلسة" }, { status: 403 });
  }

  const body = await request.json();
  const sessionDate = body.sessionDate ? new Date(body.sessionDate) : undefined;

  const updated = await prisma.session.update({
    where: { id },
    data: {
      sessionType: body.sessionType ?? undefined,
      sessionDate,
      hijriDate: sessionDate ? toHijri(sessionDate) : undefined,
      court: body.court ?? undefined,
      status: body.status ?? undefined,
      reminderBefore: body.reminderBefore !== undefined ? Number(body.reminderBefore) : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "Session",
      resourceId: id,
    },
  });

  return NextResponse.json(updated);
}
