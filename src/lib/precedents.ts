// مدوّنة الأحكام — بنك سوابق قضائية مكتبي. تسميات + صلاحيات بالدور (لا بـ ACL القضية).
import type { CaseType, PrecedentSource, UserRole, VerdictDegree, VerdictResult } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";
import { VERDICT_DEGREE_LABELS_AR, VERDICT_RESULT_LABELS_AR } from "@/lib/verdicts";

export { VERDICT_DEGREE_LABELS_AR, VERDICT_RESULT_LABELS_AR };

export const PRECEDENT_CASE_TYPE_LABELS_AR: Record<CaseType, string> = {
  general: "عام",
  commercial: "تجاري",
  labor: "عمالي",
  personal_status: "أحوال شخصية",
  criminal: "جزائي",
  administrative: "إداري",
  committee: "لجان",
  arbitration: "تحكيم",
  debt_collection: "تحصيل ديون",
  other: "أخرى",
};

export const PRECEDENT_SOURCE_LABELS_AR: Record<PrecedentSource, string> = {
  internal: "من قضايانا",
  external: "خارجية",
};

// وسم لوني لكل تصنيف (بنمط شارات النظام).
export const PRECEDENT_CASE_TYPE_STYLES: Record<CaseType, string> = {
  general: "bg-slate-100 text-slate-700",
  commercial: "bg-blue-100 text-blue-700",
  labor: "bg-amber-100 text-amber-700",
  personal_status: "bg-pink-100 text-pink-700",
  criminal: "bg-red-100 text-red-700",
  administrative: "bg-purple-100 text-purple-700",
  committee: "bg-teal-100 text-teal-700",
  arbitration: "bg-indigo-100 text-indigo-700",
  debt_collection: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

export function isCaseType(v: unknown): v is CaseType {
  return typeof v === "string" && v in PRECEDENT_CASE_TYPE_LABELS_AR;
}
export function isVerdictDegreeValue(v: unknown): v is VerdictDegree {
  return v === "first_instance" || v === "appeal" || v === "supreme";
}
export function isVerdictResultValue(v: unknown): v is VerdictResult {
  return v === "in_favor" || v === "against" || v === "partial";
}
export function isPrecedentSource(v: unknown): v is PrecedentSource {
  return v === "internal" || v === "external";
}

// ═══════════ الصلاحيات (بالدور — مكتبية لا مقيّدة بقضية) ═══════════

/** الطاقم القانوني: يرى المدوّنة (مرجع تعليمي). السكرتارية/المحاسب لا (مرجع قانوني). */
const LEGAL_STAFF: UserRole[] = ["system_admin", "supervisor", "lawyer", "researcher"];

export function canViewPrecedents(role: UserRole): boolean {
  return LEGAL_STAFF.includes(role);
}

/** الإضافة: المحامي + الباحث + مسؤول النظام (والمشرف ضمن الطاقم القانوني). */
export function canAddPrecedents(role: UserRole): boolean {
  return LEGAL_STAFF.includes(role);
}

/** التعديل/الحذف: المُضيف (createdById) أو مسؤول النظام. */
export function canEditPrecedent(user: SessionUser, precedent: { createdById: string }): boolean {
  return user.role === "system_admin" || precedent.createdById === user.id;
}
