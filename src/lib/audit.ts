import type { AuditAction, Prisma } from "@prisma/client";

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilters = {
  q?: string | null;
  userId?: string | null;
  action?: string | null;
  resourceType?: string | null;
  from?: string | null;
  to?: string | null;
};

export function buildAuditWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const q = filters.q?.trim();
  return {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: filters.action as AuditAction } : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { resourceType: { contains: q, mode: "insensitive" as const } },
            { resourceId: { contains: q, mode: "insensitive" as const } },
            { user: { fullName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

export const AUDIT_ACTION_LABELS_AR: Record<AuditAction, string> = {
  view: "عرض",
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
};

export const AUDIT_ACTION_STYLES: Record<AuditAction, string> = {
  view: "bg-slate-100 text-slate-700",
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-amber-100 text-amber-700",
  delete: "bg-red-100 text-red-700",
};

/** أسماء الموارد بالعربية + مسار الرابط إن وُجد (بعض الموارد ليست لها صفحة مستقلة). */
export const RESOURCE_TYPE_LABELS_AR: Record<string, string> = {
  Case: "قضية",
  Client: "عميل",
  Document: "مستند",
  Session: "جلسة",
  SessionMinutes: "محضر جلسة",
  CaseFlowStage: "مرحلة مسار",
  CaseClosureRequest: "طلب إغلاق",
  CaseReopenLog: "إعادة فتح قضية",
  AmicableSettlement: "تسوية ودية",
  Invoice: "فاتورة",
  Expense: "مصروف",
  User: "مستخدم",
};

/** رابط المورد داخل النظام إن كان له صفحة مباشرة. */
export function resourceLink(resourceType: string, resourceId: string): string | null {
  switch (resourceType) {
    case "Case":
      return `/cases/${resourceId}`;
    case "Client":
      return `/clients/${resourceId}`;
    default:
      return null;
  }
}

export function resourceTypeLabel(resourceType: string): string {
  return RESOURCE_TYPE_LABELS_AR[resourceType] ?? resourceType;
}
