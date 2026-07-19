import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma, TaskCategory, TaskPriority, TaskStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { canAccessIntake } from "@/lib/intake";
import { canAssignTaskTo, taskVisibilityWhere } from "@/lib/tasks";
import { canAccessService } from "@/lib/services";
import { notify } from "@/lib/notifications/send";

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
const STATUSES: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled"];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const assignedToId = searchParams.get("assignedToId");
  const caseId = searchParams.get("caseId");

  const filters: Prisma.TaskWhereInput[] = [taskVisibilityWhere(session.user)];

  // «متأخرة» حالة مشتقّة (استحقاق فائت ولم تُنجز).
  if (status === "overdue") {
    filters.push({ status: { in: ["pending", "in_progress"] }, dueDate: { lt: new Date() } });
  } else if (status && STATUSES.includes(status as TaskStatus)) {
    filters.push({ status: status as TaskStatus });
  }
  if (priority && PRIORITIES.includes(priority as TaskPriority)) {
    filters.push({ priority: priority as TaskPriority });
  }
  if (category && CATEGORIES.includes(category as TaskCategory)) {
    filters.push({ category: category as TaskCategory });
  }
  if (assignedToId) filters.push({ assignedToId });
  if (caseId) filters.push({ caseId });
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { taskNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const tasks = await prisma.task.findMany({
    where: { AND: filters },
    orderBy: [{ createdAt: "desc" }],
    include: {
      assignedTo: { select: { fullName: true } },
      assignedBy: { select: { fullName: true } },
      case: { select: { id: true, internalNumber: true, title: true } },
      intake: { select: { id: true, requestNumber: true } },
    },
  });

  return NextResponse.json(tasks);
}

async function generateTaskNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.task.findFirst({
    where: { taskNumber: { startsWith: `TSK-${year}-` } },
    orderBy: { taskNumber: "desc" },
    select: { taskNumber: true },
  });
  const lastSeq = last ? parseInt(last.taskNumber.split("-")[2] ?? "0", 10) : 0;
  return `TSK-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const category = body.category as TaskCategory;
  const priority = (body.priority as TaskPriority) || "normal";
  const caseId: string | null = body.caseId || null;
  const serviceId: string | null = body.serviceId || null;
  const intakeId: string | null = body.intakeId || null;

  // المُسندون: قائمة (تعدّد) مع سقوط احتياطي لـ assignedToId المفرد للتوافق.
  const rawAssignees: string[] = Array.isArray(body.assigneeIds)
    ? body.assigneeIds.filter((x: unknown): x is string => typeof x === "string")
    : typeof body.assignedToId === "string" && body.assignedToId
      ? [body.assignedToId]
      : [];
  const assigneeIds = [...new Set(rawAssignees)];

  if (!title) return NextResponse.json({ error: "عنوان المهمة مطلوب" }, { status: 400 });
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "فئة المهمة مطلوبة" }, { status: 400 });
  }
  if (!PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });
  }
  if (assigneeIds.length === 0) {
    return NextResponse.json({ error: "يجب تحديد مُسند واحد على الأقل" }, { status: 400 });
  }
  // ربط واحد فقط بين قضية/خدمة/طلب.
  if ([caseId, serviceId, intakeId].filter(Boolean).length > 1) {
    return NextResponse.json({ error: "يُسمح بربط المهمة بقضية أو خدمة أو طلب واحد فقط" }, { status: 400 });
  }

  // تحقّق كل مُسند: نشط + صلاحية الإسناد إليه.
  for (const uid of assigneeIds) {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, isActive: true } });
    if (!u || !u.isActive) {
      return NextResponse.json({ error: "أحد الموظفين المسند إليهم غير صالح" }, { status: 400 });
    }
    if (!(await canAssignTaskTo(prisma, session.user, uid))) {
      return NextResponse.json({ error: "لا تملك صلاحية الإسناد لأحد الموظفين المختارين" }, { status: 403 });
    }
  }

  // تحقّق صلاحية الوصول للكيان المرتبط.
  if (caseId) {
    const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { team: true, accessOverrides: true } });
    if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
    if (!canAccessCase(session.user, caseData)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذه القضية" }, { status: 403 });
    }
  }
  if (serviceId) {
    const svc = await prisma.legalService.findUnique({ where: { id: serviceId }, select: { id: true, assignedToId: true, createdById: true } });
    if (!svc) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
    if (!canAccessService(session.user, svc)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذه الخدمة" }, { status: 403 });
    }
  }
  if (intakeId) {
    const intake = await prisma.intakeRequest.findUnique({ where: { id: intakeId }, select: { id: true, receivedById: true } });
    if (!intake) return NextResponse.json({ error: "طلب الاستلام غير موجود" }, { status: 404 });
    if (!canAccessIntake(session.user, intake)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لطلب الاستلام" }, { status: 403 });
    }
  }

  let dueDate: Date | null = null;
  if (body.dueDate) {
    const parsed = new Date(body.dueDate);
    if (!Number.isNaN(parsed.getTime())) dueDate = parsed;
  }

  const created = await prisma.$transaction(async (tx) => {
    const taskNumber = await generateTaskNumber(tx);
    return tx.task.create({
      data: {
        taskNumber,
        title,
        description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
        category,
        priority,
        assignedToId: assigneeIds[0], // المُسند الرئيسي (للتوافق)
        assignedById: session.user.id,
        caseId,
        serviceId,
        intakeId,
        dueDate,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      },
    });
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "Task", resourceId: created.id },
  });

  // إشعار كل مُسند (عدا المُنشئ).
  const notifPriority = priority === "urgent" ? "urgent" : priority === "high" ? "high" : "normal";
  for (const uid of assigneeIds) {
    if (uid === session.user.id) continue;
    await notify({
      recipientId: uid,
      type: "task_assigned",
      priority: notifPriority,
      title: "أُسندت إليك مهمة",
      message: `المهمة «${created.title}» (${created.taskNumber}).`,
      actionUrl: `/tasks/${created.id}`,
      resourceType: "Task",
      resourceId: created.id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json(created, { status: 201 });
}
