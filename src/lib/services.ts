import type { Prisma, ServicePriority, ServiceStatus, ServiceTeamRole, ServiceType, UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";

export const SERVICE_TEAM_ROLE_LABELS_AR: Record<ServiceTeamRole, string> = {
  lead: "المحامي الرئيسي",
  co: "محامٍ مشارك",
};

/** يبني صفوف فريق الدراسة: محامٍ رئيسي واحد + مشاركون (بلا تكرار، والرئيسي مستبعد من المشاركين). */
export function buildServiceTeamRows(
  leadId: string,
  coIds: string[]
): { userId: string; roleInService: ServiceTeamRole }[] {
  const cos = [...new Set(coIds.filter((x) => x && x !== leadId))];
  return [
    { userId: leadId, roleInService: "lead" },
    ...cos.map((userId) => ({ userId, roleInService: "co" as ServiceTeamRole })),
  ];
}

export const SERVICE_TYPE_LABELS_AR: Record<ServiceType, string> = {
  legal_consultation: "استشارة قانونية",
  company_formation: "تأسيس شركة",
  documentation: "توثيق",
  execution_request: "طلب تنفيذ",
  contract_drafting: "صياغة عقود",
  other: "أخرى",
};

export const SERVICE_STATUS_LABELS_AR: Record<ServiceStatus, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  pending_client: "بانتظار العميل",
  under_review: "قيد المراجعة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const SERVICE_STATUS_STYLES: Record<ServiceStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-700",
  pending_client: "bg-blue-100 text-blue-700",
  under_review: "bg-purple-100 text-purple-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export const SERVICE_PRIORITY_LABELS_AR: Record<ServicePriority, string> = {
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

export const SERVICE_ACTIVE_STATUSES: ServiceStatus[] = ["new", "in_progress", "pending_client", "under_review"];

type ServiceAccessInput = {
  assignedToId: string;
  createdById: string;
  team?: { userId: string }[];
};

/** الإدارة/السكرتارية/المحاسب يرون كل الدراسات؛ المحامي/الباحث يرون دراساتهم فقط (رئيسي/مشارك/منشئ). */
export function serviceVisibilityWhere(user: SessionUser): Prisma.LegalServiceWhereInput {
  if (["system_admin", "supervisor", "secretary", "accountant"].includes(user.role)) return {};
  return {
    OR: [
      { assignedToId: user.id },
      { createdById: user.id },
      { team: { some: { userId: user.id } } },
    ],
  };
}

export function canAccessService(user: SessionUser, service: ServiceAccessInput): boolean {
  if (["system_admin", "supervisor", "secretary", "accountant"].includes(user.role)) return true;
  if (service.assignedToId === user.id || service.createdById === user.id) return true;
  return service.team?.some((m) => m.userId === user.id) ?? false;
}

/** إنشاء الخدمات متاح للجميع عدا المحاسب. */
export function canCreateService(role: UserRole): boolean {
  return role !== "accountant";
}

/** تعديل بيانات الخدمة (عدا الأتعاب) — الإدارة أو المسؤول عنها أو منشئها، لا المحاسب. */
export function canEditService(user: SessionUser, service: ServiceAccessInput): boolean {
  if (user.role === "accountant") return false;
  if (user.role === "system_admin" || user.role === "supervisor") return true;
  return service.assignedToId === user.id || service.createdById === user.id;
}

/** الأتعاب: المحاسب والإدارة فقط. */
export function canManageServiceFee(role: UserRole): boolean {
  return role === "accountant" || role === "system_admin" || role === "supervisor";
}

/** توليد رقم خدمة SRV-YYYY-NNNN بأسلوب أكبر رقم (يتحمّل الفجوات). */
export async function generateServiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.legalService.findFirst({
    where: { serviceNumber: { startsWith: `SRV-${year}-` } },
    orderBy: { serviceNumber: "desc" },
    select: { serviceNumber: true },
  });
  const lastSeq = last ? parseInt(last.serviceNumber.split("-")[2] ?? "0", 10) : 0;
  return `SRV-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}
