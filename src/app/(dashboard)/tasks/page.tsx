import { getServerSession } from "next-auth/next";
import type { Prisma, TaskCategory, TaskPriority, TaskStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";
import { intakeVisibilityWhere } from "@/lib/intake";
import { serviceVisibilityWhere } from "@/lib/services";
import {
  displayTaskStatus,
  getAssignableUsers,
  taskVisibilityWhere,
} from "@/lib/tasks";
import { toEnglishDigits } from "@/lib/formatNumber";
import { TasksToolbar } from "./TasksToolbar";
import { TasksBoard } from "./TasksBoard";
import { NewTaskButton } from "./NewTaskButton";

type SearchParams = {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignedToId?: string;
  caseId?: string;
};

const STATUSES: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled"];
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];
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

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;
  const now = new Date();

  const filters: Prisma.TaskWhereInput[] = [taskVisibilityWhere(session.user)];
  if (params.status === "overdue") {
    filters.push({ status: { in: ["pending", "in_progress"] }, dueDate: { lt: now } });
  } else if (params.status && STATUSES.includes(params.status as TaskStatus)) {
    filters.push({ status: params.status as TaskStatus });
  }
  if (params.priority && PRIORITIES.includes(params.priority as TaskPriority)) {
    filters.push({ priority: params.priority as TaskPriority });
  }
  if (params.category && CATEGORIES.includes(params.category as TaskCategory)) {
    filters.push({ category: params.category as TaskCategory });
  }
  if (params.assignedToId) filters.push({ assignedToId: params.assignedToId });
  if (params.caseId) filters.push({ caseId: params.caseId });
  if (params.q) {
    filters.push({
      OR: [
        { title: { contains: params.q, mode: "insensitive" } },
        { taskNumber: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }

  const [tasks, assignableUsers, cases, intakes, services] = await Promise.all([
    prisma.task.findMany({
      where: { AND: filters },
      orderBy: [{ createdAt: "desc" }],
      include: {
        assignedTo: { select: { fullName: true } },
        assignedBy: { select: { fullName: true } },
        case: { select: { id: true, internalNumber: true } },
        intake: { select: { requestNumber: true } },
      },
    }),
    getAssignableUsers(prisma, { id: session.user.id, role: session.user.role }),
    prisma.case.findMany({
      where: caseVisibilityWhere(session.user),
      orderBy: { createdAt: "desc" },
      select: { id: true, internalNumber: true, title: true },
    }),
    prisma.intakeRequest.findMany({
      where: { ...intakeVisibilityWhere(session.user), status: { notIn: ["accepted", "rejected", "cancelled"] } },
      orderBy: { receivedAt: "desc" },
      select: { id: true, requestNumber: true },
    }),
    prisma.legalService.findMany({
      where: serviceVisibilityWhere(session.user),
      orderBy: { createdAt: "desc" },
      select: { id: true, serviceNumber: true, title: true },
    }),
  ]);

  const summary = await buildSummary(session.user, now);

  const serialized = tasks.map((t) => ({
    id: t.id,
    taskNumber: t.taskNumber,
    title: t.title,
    category: t.category,
    status: displayTaskStatus(t, now),
    rawStatus: t.status,
    priority: t.priority,
    assignedToName: t.assignedTo.fullName,
    assignedByName: t.assignedBy.fullName,
    dueDate: t.dueDate?.toISOString() ?? null,
    caseId: t.case?.id ?? null,
    caseInternalNumber: t.case?.internalNumber ?? null,
    intakeRequestNumber: t.intake?.requestNumber ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">المهام</h1>
          <p className="text-sm text-foreground/60">{toEnglishDigits(tasks.length)} مهمة</p>
        </div>
        <NewTaskButton
          users={assignableUsers}
          cases={cases}
          intakes={intakes}
          services={services}
          currentUserId={session.user.id}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border border-black/5 border-r-4 ${card.accent} bg-white p-5 shadow-sm`}
          >
            <p className="text-sm text-foreground/50">{card.label}</p>
            <p className="mt-2 font-amiri text-2xl font-bold text-navy">{toEnglishDigits(card.value)}</p>
          </div>
        ))}
      </div>

      <TasksToolbar users={assignableUsers} cases={cases} />

      <TasksBoard tasks={serialized} />
    </div>
  );
}

async function buildSummary(user: SessionUser, now: Date) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const mineWhere = { OR: [{ assignedToId: user.id }, { assignees: { some: { userId: user.id } } }] };
  const [myPending, overdue, completedThisWeek, assignedByMe] = await Promise.all([
    prisma.task.count({
      where: { ...mineWhere, status: { in: ["pending", "in_progress"] } },
    }),
    prisma.task.count({
      where: { ...mineWhere, status: { in: ["pending", "in_progress"] }, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: { ...mineWhere, status: "completed", completedAt: { gte: weekAgo } },
    }),
    prisma.task.count({
      where: { assignedById: user.id, assignedToId: { not: user.id }, status: { not: "cancelled" } },
    }),
  ]);

  return [
    { label: "مهامي المعلقة", value: myPending, accent: "border-r-navy" },
    { label: "مهام متأخرة", value: overdue, accent: "border-r-red-500" },
    { label: "أُنجزت هذا الأسبوع", value: completedThisWeek, accent: "border-r-emerald-500" },
    { label: "أُسندتها لآخرين", value: assignedByMe, accent: "border-r-gold" },
  ];
}
