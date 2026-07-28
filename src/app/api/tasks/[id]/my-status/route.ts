import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { TaskAssigneeStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assigneeCanComplete, computeTaskStatusFromAssignees, isTaskLocked } from "@/lib/tasks";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/**
 * تحديث حالة المُسند الحالي ضمن مهمة متعددة المُسندين.
 * تُعاد حساب حالة المهمة الإجمالية من حالات كل المُسندين.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { assignees: true },
  });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

  const mine = task.assignees.find((a) => a.userId === session.user.id);
  if (!mine) return NextResponse.json({ error: "لست ضمن المُسندين لهذه المهمة" }, { status: 403 });

  if (isTaskLocked(task.status)) {
    return NextResponse.json({ error: "المهمة مرفوضة ومقفلة — أنشئ نسخة جديدة." }, { status: 403 });
  }
  if (task.status === "cancelled") {
    return NextResponse.json({ error: "المهمة ملغاة" }, { status: 400 });
  }
  // صلاحية «مشاهدة»/«تعديل» لا تملك نصيبًا تُنجزه.
  if (!assigneeCanComplete(mine)) {
    return NextResponse.json(
      { error: "صلاحيتك على هذه المهمة (مشاهدة/تعديل) لا تسمح بتحديث نصيبك" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const status = body.status as TaskAssigneeStatus;
  if (!["in_progress", "completed", "declined"].includes(status)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }
  const completionNote = typeof body.completionNote === "string" ? body.completionNote.trim() : "";
  if (status === "completed" && !completionNote) {
    return NextResponse.json({ error: "ملخص الإنجاز مطلوب" }, { status: 400 });
  }

  await prisma.taskAssignee.update({
    where: { id: mine.id },
    data: {
      status,
      completedAt: status === "completed" ? new Date() : null,
      completionNote: status === "completed" ? completionNote : status === "declined" ? completionNote || null : null,
    },
  });

  // إعادة حساب حالة المهمة الإجمالية (المشاهد/المعدّل لا يُحتسبان كمنجِزين).
  const fresh = await prisma.taskAssignee.findMany({
    where: { taskId: id },
    select: { status: true, permission: true },
  });
  const computed = computeTaskStatusFromAssignees(fresh);
  const wasCompleted = task.status === "completed";

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: computed.status,
      startedAt: computed.status !== "pending" && !task.startedAt ? new Date() : task.startedAt,
      completedAt: computed.completed ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Task", resourceId: id },
  });

  // إشعار المُنشئ عند إنجاز هذا المكلّف نصيبه (لكل مكلّف).
  if (status === "completed" && task.assignedById !== session.user.id) {
    await notify({
      recipientId: task.assignedById,
      type: "task_assignee_completed",
      priority: "normal",
      title: "مكلّف أنجز نصيبه",
      message: `أنجز أحد المكلّفين نصيبه من المهمة «${task.title}» (${task.taskNumber}).`,
      actionUrl: `/tasks/${id}`,
      resourceType: "Task",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  // عند اكتمال المهمة بالكامل لأول مرة → إشعار المُنشئ.
  if (computed.completed && !wasCompleted && task.assignedById !== session.user.id) {
    await notify({
      recipientId: task.assignedById,
      type: "task_completed",
      priority: "normal",
      title: "أُنجزت مهمة أسندتها",
      message: `أُنجزت المهمة «${task.title}» (${task.taskNumber}) بالكامل.`,
      actionUrl: `/tasks/${id}`,
      resourceType: "Task",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ task: updated, myStatus: status });
}
