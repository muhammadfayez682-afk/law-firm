import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { TaskAssigneePermission, TaskCategory, TaskPriority } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assigneeCanEdit,
  canAccessTask,
  canAssignTaskTo,
  canManageTask,
  computeTaskStatusFromAssignees,
  isTaskLocked,
  isValidAssigneePermission,
} from "@/lib/tasks";

type Params = { params: Promise<{ id: string }> };

const CATEGORIES: TaskCategory[] = [
  "case_related",
  "administrative",
  "research",
  "document_preparation",
  "meeting",
  "follow_up",
  "personal",
  "other",
];
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { fullName: true } },
      assignedBy: { select: { fullName: true } },
      assignees: { include: { user: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
      case: { select: { id: true, internalNumber: true, title: true } },
      service: { select: { id: true, serviceNumber: true, title: true } },
      intake: { select: { id: true, requestNumber: true } },
      comments: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (!canAccessTask(session.user, task)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول" }, { status: 403 });
  }
  return NextResponse.json(task);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, include: { assignees: true } });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

  // ⚠️ المهمة المرفوضة مقفلة تمامًا — لا تعديل على محتواها أو حالتها أو مكلّفيها.
  if (isTaskLocked(task.status)) {
    return NextResponse.json(
      { error: "المهمة مرفوضة ومقفلة — أنشئ نسخة جديدة." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const isManager = canManageTask(session.user, task);

  // ===== إجراء الرفض (قفل المهمة) — للمُنشئ/الإدارة فقط =====
  if (body.status === "rejected") {
    if (!isManager) {
      return NextResponse.json({ error: "رفض المهمة متاح للمُنشئ أو الإدارة فقط" }, { status: 403 });
    }
    if (task.status === "completed" || task.status === "cancelled") {
      return NextResponse.json({ error: "لا يمكن رفض مهمة منجزة أو ملغاة" }, { status: 400 });
    }
    const updated = await prisma.task.update({ where: { id }, data: { status: "rejected" } });
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "update", resourceType: "Task", resourceId: id },
    });
    return NextResponse.json(updated);
  }

  // ===== تعديل المحتوى: المُنشئ/الإدارة، أو مكلّف بصلاحية «تعديل/إكمال» =====
  const myAssignee = task.assignees.find((a) => a.userId === session.user.id);
  const canEditContent = isManager || (myAssignee != null && assigneeCanEdit(myAssignee));
  if (!canEditContent) {
    return NextResponse.json(
      { error: "تعديل المهمة متاح للمُنشئ أو الإدارة أو مكلّف بصلاحية تعديل" },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.description !== undefined) {
    data.description = typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;
  }
  if (body.category && CATEGORIES.includes(body.category)) data.category = body.category;
  if (body.priority && PRIORITIES.includes(body.priority)) data.priority = body.priority;
  if (body.dueDate !== undefined) {
    if (body.dueDate) {
      const parsed = new Date(body.dueDate);
      data.dueDate = Number.isNaN(parsed.getTime()) ? null : parsed;
    } else {
      data.dueDate = null;
    }
  }

  // ===== تعديل قائمة المكلّفين وصلاحياتهم — للمُنشئ/الإدارة فقط =====
  if (Array.isArray(body.assignees) && isManager) {
    const desired = new Map<string, TaskAssigneePermission>();
    for (const a of body.assignees) {
      if (a && typeof a.userId === "string") {
        desired.set(a.userId, isValidAssigneePermission(a.permission) ? a.permission : "complete");
      }
    }
    if (desired.size === 0) {
      return NextResponse.json({ error: "يجب إبقاء مُسند واحد على الأقل" }, { status: 400 });
    }
    // تحقّق صلاحية الإسناد للمُضافين الجدد.
    const existingIds = new Set(task.assignees.map((a) => a.userId));
    for (const uid of desired.keys()) {
      if (existingIds.has(uid)) continue;
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
      if (!u || !u.isActive) return NextResponse.json({ error: "أحد المكلّفين غير صالح" }, { status: 400 });
      if (!(await canAssignTaskTo(prisma, session.user, uid))) {
        return NextResponse.json({ error: "لا تملك صلاحية الإسناد لأحد المكلّفين" }, { status: 403 });
      }
    }
    await prisma.$transaction(async (tx) => {
      // حذف المُزالين، تحديث صلاحية الباقين، إضافة الجدد (بحالة ابتدائية).
      await tx.taskAssignee.deleteMany({
        where: { taskId: id, userId: { notIn: [...desired.keys()] } },
      });
      for (const [uid, permission] of desired) {
        if (existingIds.has(uid)) {
          await tx.taskAssignee.update({ where: { taskId_userId: { taskId: id, userId: uid } }, data: { permission } });
        } else {
          await tx.taskAssignee.create({ data: { taskId: id, userId: uid, permission } });
        }
      }
      // المُسند الرئيسي (assignedToId) يبقى صالحًا إن ظلّ ضمن القائمة، وإلا يصبح أول مكلّف.
      if (!desired.has(task.assignedToId)) {
        data.assignedToId = [...desired.keys()][0];
      }
    });
  }

  const updated = await prisma.task.update({ where: { id }, data });

  // إعادة اشتقاق حالة المهمة من المكلّفين (إن لم تُكن رُفضت/أُلغيت).
  if (task.status !== "cancelled") {
    const fresh = await prisma.taskAssignee.findMany({
      where: { taskId: id },
      select: { status: true, permission: true },
    });
    const computed = computeTaskStatusFromAssignees(fresh);
    if (computed.status !== updated.status) {
      await prisma.task.update({
        where: { id },
        data: { status: computed.status, completedAt: computed.completed ? new Date() : null },
      });
    }
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Task", resourceId: id },
  });

  return NextResponse.json(updated);
}

/** إلغاء ناعم — يُحدَّث للحالة «ملغاة» ولا يُحذف السجل. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (!canManageTask(session.user, task)) {
    return NextResponse.json({ error: "إلغاء المهمة متاح للمُنشئ أو الإدارة فقط" }, { status: 403 });
  }
  if (task.status === "completed") {
    return NextResponse.json({ error: "لا يمكن إلغاء مهمة منجزة" }, { status: 400 });
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
