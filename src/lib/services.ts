import type { Prisma, ServicePriority, ServiceStatus, ServiceType, UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";

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

type ServiceAccessInput = { assignedToId: string; createdById: string };

/** الإدارة/السكرتارية/المحاسب يرون كل الخدمات؛ المحامي/الباحث يرون خدماتهم فقط. */
export function serviceVisibilityWhere(user: SessionUser): Prisma.LegalServiceWhereInput {
  if (["system_admin", "supervisor", "secretary", "accountant"].includes(user.role)) return {};
  return { OR: [{ assignedToId: user.id }, { createdById: user.id }] };
}

export function canAccessService(user: SessionUser, service: ServiceAccessInput): boolean {
  if (["system_admin", "supervisor", "secretary", "accountant"].includes(user.role)) return true;
  return service.assignedToId === user.id || service.createdById === user.id;
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
