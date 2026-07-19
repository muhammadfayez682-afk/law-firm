import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTask } from "@/lib/tasks";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** إضافة ملاحظة على المهمة — لأي مستخدم يرى المهمة. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, assignedToId: true, assignedById: true, title: true, taskNumber: true, assignees: { select: { userId: true } } },
  });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (!canAccessTask(session.user, task)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول" }, { status: 403 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "نص الملاحظة مطلوب" }, { status: 400 });

  const comment = await prisma.taskComment.create({
    data: { taskId: id, authorId: session.user.id, content },
    include: { author: { select: { fullName: true } } },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "TaskComment", resourceId: comment.id },
  });

  // إشعار كل أطراف المهمة (المُسندون + المُنشئ) عدا كاتب الملاحظة.
  const otherPartyIds = [
    task.assignedById,
    ...task.assignees.map((a) => a.userId),
  ].filter((uid) => uid !== session.user.id);
  await notifyBulk(otherPartyIds, {
    type: "task_comment_added",
    priority: "normal",
    title: "ملاحظة جديدة على مهمة",
    message: `أُضيفت ملاحظة على المهمة «${task.title}» (${task.taskNumber}).`,
    actionUrl: `/tasks/${id}`,
    resourceType: "Task",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(comment, { status: 201 });
}
