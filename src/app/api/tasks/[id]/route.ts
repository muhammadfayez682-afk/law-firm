import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { TaskCategory, TaskPriority } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTask, canAssignTaskTo, canManageTask } from "@/lib/tasks";

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
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (!canManageTask(session.user, task)) {
    return NextResponse.json({ error: "تعديل المهمة متاح للمُنشئ أو الإدارة فقط" }, { status: 403 });
  }

  const body = await request.json();
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
  if (typeof body.assignedToId === "string" && body.assignedToId && body.assignedToId !== task.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: body.assignedToId },
      select: { isActive: true },
    });
    if (!assignee || !assignee.isActive) {
      return NextResponse.json({ error: "الموظف المسند إليه غير صالح" }, { status: 400 });
    }
    if (!(await canAssignTaskTo(prisma, session.user, body.assignedToId))) {
      return NextResponse.json({ error: "لا تملك صلاحية الإسناد لهذا الموظف" }, { status: 403 });
    }
    data.assignedToId = body.assignedToId;
  }

  const updated = await prisma.task.update({ where: { id }, data });

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
