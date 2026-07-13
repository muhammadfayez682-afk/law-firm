import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma, TaskCategory, TaskPriority, TaskStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { canAccessIntake } from "@/lib/intake";
import { canAssignTaskTo, taskVisibilityWhere } from "@/lib/tasks";

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
  const assignedToId = typeof body.assignedToId === "string" ? body.assignedToId : "";
  const priority = (body.priority as TaskPriority) || "normal";
  const caseId: string | null = body.caseId || null;
  const intakeId: string | null = body.intakeId || null;

  if (!title) return NextResponse.json({ error: "عنوان المهمة مطلوب" }, { status: 400 });
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "فئة المهمة مطلوبة" }, { status: 400 });
  }
  if (!PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });
  }
  if (!assignedToId) {
    return NextResponse.json({ error: "يجب تحديد الموظف المسند إليه" }, { status: 400 });
  }

  // تحقّق أن المسند إليه موظف نشط.
  const assignee = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { id: true, isActive: true },
  });
  if (!assignee || !assignee.isActive) {
    return NextResponse.json({ error: "الموظف المسند إليه غير صالح" }, { status: 400 });
  }
  if (!(await canAssignTaskTo(prisma, session.user, assignedToId))) {
    return NextResponse.json({ error: "لا تملك صلاحية الإسناد لهذا الموظف" }, { status: 403 });
  }

  // تحقّق صلاحية الوصول للقضية/الطلب المرتبط إن وُجد.
  if (caseId) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { team: true, accessOverrides: true },
    });
    if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
    if (!canAccessCase(session.user, caseData)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذه القضية" }, { status: 403 });
    }
  }
  if (intakeId) {
    const intake = await prisma.intakeRequest.findUnique({
      where: { id: intakeId },
      select: { id: true, receivedById: true },
    });
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
        description: typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
        category,
        priority,
        assignedToId,
        assignedById: session.user.id,
        caseId,
        intakeId,
        dueDate,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Task",
      resourceId: created.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
