import type { Prisma, TaskAssigneeStatus, TaskCategory, TaskPriority, TaskStatus, UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";
import { isManagement } from "@/lib/rbac";

export const TASK_STATUS_LABELS_AR: Record<TaskStatus, string> = {
  pending: "معلقة",
  in_progress: "قيد التنفيذ",
  completed: "منجزة",
  cancelled: "ملغاة",
  overdue: "متأخرة",
};

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-gray-200 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
  overdue: "bg-red-100 text-red-700",
};

export const TASK_PRIORITY_LABELS_AR: Record<TaskPriority, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-gray-100 text-gray-500",
  normal: "bg-slate-100 text-slate-600",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export const TASK_CATEGORY_LABELS_AR: Record<TaskCategory, string> = {
  case_related: "مرتبطة بقضية",
  administrative: "إدارية",
  research: "بحث",
  document_preparation: "إعداد مستندات",
  meeting: "اجتماع",
  follow_up: "متابعة",
  personal: "شخصية",
  other: "أخرى",
};

export const TASK_CATEGORY_STYLES: Record<TaskCategory, string> = {
  case_related: "bg-navy/10 text-navy",
  administrative: "bg-slate-100 text-slate-600",
  research: "bg-purple-100 text-purple-700",
  document_preparation: "bg-gold/15 text-gold",
  meeting: "bg-blue-100 text-blue-700",
  follow_up: "bg-taradhi/10 text-taradhi",
  personal: "bg-pink-100 text-pink-700",
  other: "bg-gray-100 text-gray-600",
};

/** أعمدة عرض الكانبان (لا تشمل الملغاة والمتأخرة كأعمدة مستقلة). */
export const TASK_KANBAN_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "معلقة" },
  { status: "in_progress", label: "قيد التنفيذ" },
  { status: "completed", label: "منجزة" },
];

type OverdueInput = { status: TaskStatus; dueDate: Date | string | null };

/** المهمة متأخرة إذا كانت معلقة/قيد التنفيذ وتجاوزت تاريخ الاستحقاق. */
export function isTaskOverdue(task: OverdueInput, now: Date = new Date()): boolean {
  if (task.status !== "pending" && task.status !== "in_progress") return false;
  if (!task.dueDate) return false;
  return new Date(task.dueDate).getTime() < now.getTime();
}

/** الحالة المعروضة: تتحول إلى «متأخرة» تلقائيًا عند فوات الاستحقاق. */
export function displayTaskStatus(task: OverdueInput, now?: Date): TaskStatus {
  return isTaskOverdue(task, now) ? "overdue" : task.status;
}

// ── الصلاحيات ──────────────────────────────────────────────

/**
 * رؤية المهام:
 * - مسؤول النظام والمشرف: كل المهام.
 * - غيرهم: المهام المسندة إليهم أو التي أنشأوها.
 */
export function taskVisibilityWhere(user: SessionUser): Prisma.TaskWhereInput {
  if (isManagement(user.role) || user.role === "supervisor") return {};
  return {
    OR: [
      { assignedToId: user.id },
      { assignedById: user.id },
      { assignees: { some: { userId: user.id } } },
    ],
  };
}

/** هل يستطيع المستخدم فتح مهمة محددة؟ (يشمل المُسندين المتعددين) */
export function canAccessTask(
  user: SessionUser,
  task: { assignedToId: string; assignedById: string; assignees?: { userId: string }[] }
): boolean {
  if (isManagement(user.role) || user.role === "supervisor") return true;
  if (task.assignedToId === user.id || task.assignedById === user.id) return true;
  return (task.assignees ?? []).some((a) => a.userId === user.id);
}

/**
 * تُشتقّ حالة المهمة من حالات مُسنديها:
 * - منجزة: كل المُسندين غير المنسحبين منجزون (وواحد على الأقل منجز).
 * - قيد التنفيذ: أي مُسند بدأ أو أنجز (دون اكتمال الكل).
 * - معلقة: لم يبدأ أحد.
 */
export function computeTaskStatusFromAssignees(
  assignees: { status: TaskAssigneeStatus }[]
): { status: "pending" | "in_progress" | "completed"; completed: boolean } {
  const active = assignees.filter((a) => a.status !== "declined");
  const completed = active.filter((a) => a.status === "completed").length;
  const anyStarted = assignees.some((a) => a.status === "in_progress" || a.status === "completed");
  if (active.length > 0 && completed === active.length) {
    return { status: "completed", completed: true };
  }
  if (anyStarted) return { status: "in_progress", completed: false };
  return { status: "pending", completed: false };
}

/** المشرف ومسؤول النظام يسندون لأي موظف. */
export function canAssignToAnyone(role: UserRole): boolean {
  return role === "system_admin" || role === "supervisor";
}

/** تعديل حالة المهمة: المسند إليه (تقدّم) أو المُنشئ/الإدارة (إلغاء). */
export function canChangeTaskStatus(
  user: SessionUser,
  task: { assignedToId: string; assignedById: string }
): boolean {
  return canAccessTask(user, task);
}

/** تعديل بيانات المهمة أو إلغاؤها: المُنشئ أو الإدارة/المشرف. */
export function canManageTask(
  user: SessionUser,
  task: { assignedById: string }
): boolean {
  if (isManagement(user.role) || user.role === "supervisor") return true;
  return task.assignedById === user.id;
}

/**
 * تحقّق أن المُنشئ يحق له إسناد المهمة لهذا الموظف:
 * - المشرف/مسؤول النظام: أي موظف.
 * - إسناد لنفسه: مسموح للجميع.
 * - المحامي/الباحث: لباحث يشاركه فريق قضية.
 */
export async function canAssignTaskTo(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  creator: SessionUser,
  assigneeId: string
): Promise<boolean> {
  if (canAssignToAnyone(creator.role)) return true;
  if (assigneeId === creator.id) return true;
  if (creator.role !== "lawyer" && creator.role !== "researcher") return false;

  const shared = await tx.user.findFirst({
    where: {
      id: assigneeId,
      isActive: true,
      role: "researcher",
      caseTeamMemberships: { some: { case: { team: { some: { userId: creator.id } } } } },
    },
    select: { id: true },
  });
  return Boolean(shared);
}

/** قائمة الموظفين الذين يمكن للمستخدم إسناد المهام إليهم. */
export async function getAssignableUsers(
  prisma: typeof import("@/lib/prisma").prisma,
  user: { id: string; role: UserRole; fullName?: string }
): Promise<{ id: string; fullName: string; role: UserRole }[]> {
  if (canAssignToAnyone(user.role)) {
    return prisma.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true },
    });
  }

  const self = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, fullName: true, role: true },
  });
  const list = self ? [self] : [];

  if (user.role === "lawyer" || user.role === "researcher") {
    const researchers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: "researcher",
        id: { not: user.id },
        caseTeamMemberships: { some: { case: { team: { some: { userId: user.id } } } } },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true },
    });
    list.push(...researchers);
  }

  return list;
}
