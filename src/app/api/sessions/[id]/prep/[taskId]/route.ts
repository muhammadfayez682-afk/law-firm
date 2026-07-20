import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCase } from "@/lib/rbac";

type Params = { params: Promise<{ id: string; taskId: string }> };

/** تحديث مهمة تحضير جلسة (إنجاز/إلغاء إنجاز + ملاحظة). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, taskId } = await params;
  const prepTask = await prisma.sessionPreparationTask.findUnique({
    where: { id: taskId },
    include: { session: { include: { case: { include: { team: true, accessOverrides: true } } } } },
  });
  if (!prepTask || prepTask.sessionId !== id) {
    return NextResponse.json({ error: "مهمة التحضير غير موجودة" }, { status: 404 });
  }
  if (!canEditCase(session.user, prepTask.session.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل تحضير هذه الجلسة" }, { status: 403 });
  }

  const body = await request.json();
  const isCompleted = Boolean(body.isCompleted);
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : undefined;

  const updated = await prisma.sessionPreparationTask.update({
    where: { id: taskId },
    data: {
      isCompleted,
      completedById: isCompleted ? session.user.id : null,
      completedAt: isCompleted ? new Date() : null,
      ...(notes !== undefined ? { notes } : {}),
    },
    include: { completedBy: { select: { fullName: true } } },
  });

  return NextResponse.json(updated);
}
