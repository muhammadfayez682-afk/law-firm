import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTask, isTaskLocked } from "@/lib/tasks";

type Params = { params: Promise<{ id: string }> };

/**
 * إلغاء المهمة (المُنشئ/الإدارة فقط).
 * ملاحظة: بدء/إنجاز المهمة صار لكل مُسند عبر `/api/tasks/[id]/my-status`،
 * وحالة المهمة الإجمالية تُشتقّ من حالات المُسندين.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (isTaskLocked(task.status)) {
    return NextResponse.json({ error: "المهمة مرفوضة ومقفلة — أنشئ نسخة جديدة." }, { status: 403 });
  }

  const body = await request.json();
  const status = body.status;

  if (status !== "cancelled") {
    return NextResponse.json(
      { error: "بدء/إنجاز المهمة يتم لكل مُسند عبر حالته الخاصة" },
      { status: 400 }
    );
  }

  if (task.status === "completed" || task.status === "cancelled") {
    return NextResponse.json({ error: "لا يمكن إلغاء مهمة منجزة أو ملغاة" }, { status: 400 });
  }
  if (!canManageTask(session.user, task)) {
    return NextResponse.json({ error: "الإلغاء متاح للمُنشئ أو الإدارة فقط" }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Task", resourceId: id },
  });

  return NextResponse.json(updated);
}
