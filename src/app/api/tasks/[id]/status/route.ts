import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canChangeTaskStatus, canManageTask } from "@/lib/tasks";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** تغيير حالة المهمة: بدء التنفيذ / الإنجاز / الإلغاء. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (!canChangeTaskStatus(session.user, task)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل حالة المهمة" }, { status: 403 });
  }

  const body = await request.json();
  const status = body.status;

  if (task.status === "completed" || task.status === "cancelled") {
    return NextResponse.json({ error: "لا يمكن تعديل مهمة منجزة أو ملغاة" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (status === "in_progress") {
    data.status = "in_progress";
    if (!task.startedAt) data.startedAt = new Date();
  } else if (status === "completed") {
    const completionNote = typeof body.completionNote === "string" ? body.completionNote.trim() : "";
    if (!completionNote) {
      return NextResponse.json({ error: "ملخص الإنجاز مطلوب" }, { status: 400 });
    }
    data.status = "completed";
    data.completedAt = new Date();
    data.completionNote = completionNote;
    if (!task.startedAt) data.startedAt = new Date();
  } else if (status === "cancelled") {
    // الإلغاء متاح للمُنشئ/الإدارة فقط.
    if (!canManageTask(session.user, task)) {
      return NextResponse.json({ error: "الإلغاء متاح للمُنشئ أو الإدارة فقط" }, { status: 403 });
    }
    data.status = "cancelled";
    data.cancelledAt = new Date();
  } else {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const updated = await prisma.task.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Task", resourceId: id },
  });

  // إشعار مُسنِد المهمة عند إنجازها (إن كان غير المُنجِز).
  if (data.status === "completed" && task.assignedById !== session.user.id) {
    await notify({
      recipientId: task.assignedById,
      type: "task_completed",
      priority: "normal",
      title: "أُنجزت مهمة أسندتها",
      message: `أُنجزت المهمة «${task.title}» (${task.taskNumber}).`,
      actionUrl: `/tasks/${id}`,
      resourceType: "Task",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json(updated);
}
