import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { TaskAssigneeStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assigneeCanComplete,
  canManageTask,
  computeTaskStatusFromAssignees,
  isTaskLocked,
  isValidAssigneePermission,
} from "@/lib/tasks";

type Params = { params: Promise<{ id: string; userId: string }> };

/**
 * تحديث حالة/صلاحية مكلّف بعينه.
 * - المكلّف نفسه: يحدّث حالته إن كانت صلاحيته «إكمال».
 * - المُنشئ/الإدارة: يحدّث حالة أي مكلّف ويغيّر صلاحيته.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, userId } = await params;
  const task = await prisma.task.findUnique({ where: { id }, include: { assignees: true } });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

  if (isTaskLocked(task.status)) {
    return NextResponse.json({ error: "المهمة مرفوضة ومقفلة — أنشئ نسخة جديدة." }, { status: 403 });
  }
  if (task.status === "cancelled") {
    return NextResponse.json({ error: "المهمة ملغاة" }, { status: 400 });
  }

  const target = task.assignees.find((a) => a.userId === userId);
  if (!target) return NextResponse.json({ error: "المكلّف غير موجود في هذه المهمة" }, { status: 404 });

  const isManager = canManageTask(session.user, task);
  const isSelf = session.user.id === userId;
  if (!isManager && !isSelf) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذا المكلّف" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  // تغيير الصلاحية — للمُنشئ/الإدارة فقط.
  if (body.permission !== undefined) {
    if (!isManager) {
      return NextResponse.json({ error: "تغيير صلاحية المكلّف متاح للمُنشئ أو الإدارة فقط" }, { status: 403 });
    }
    if (!isValidAssigneePermission(body.permission)) {
      return NextResponse.json({ error: "صلاحية غير صالحة" }, { status: 400 });
    }
    data.permission = body.permission;
  }

  // تغيير الحالة.
  if (body.status !== undefined) {
    const status = body.status as TaskAssigneeStatus;
    if (!["pending", "in_progress", "completed", "declined"].includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }
    // المكلّف نفسه لا يحدّث حالته إلا بصلاحية «إكمال»؛ صاحب الإدارة غير مقيّد.
    const effectivePermission = (data.permission as typeof target.permission) ?? target.permission;
    if (isSelf && !isManager && !assigneeCanComplete({ permission: effectivePermission })) {
      return NextResponse.json(
        { error: "صلاحيتك (مشاهدة/تعديل) لا تسمح بتحديث نصيبك" },
        { status: 403 }
      );
    }
    const completionNote = typeof body.completionNote === "string" ? body.completionNote.trim() : "";
    if (status === "completed" && !completionNote) {
      return NextResponse.json({ error: "ملخص الإنجاز مطلوب" }, { status: 400 });
    }
    data.status = status;
    data.completedAt = status === "completed" ? new Date() : null;
    data.completionNote =
      status === "completed" ? completionNote : status === "declined" ? completionNote || null : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "لا تغييرات" }, { status: 400 });
  }

  await prisma.taskAssignee.update({ where: { id: target.id }, data });

  // إعادة اشتقاق حالة المهمة.
  const fresh = await prisma.taskAssignee.findMany({
    where: { taskId: id },
    select: { status: true, permission: true },
  });
  const computed = computeTaskStatusFromAssignees(fresh);
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

  return NextResponse.json({ task: updated, assigneeStatus: data.status ?? target.status });
}
