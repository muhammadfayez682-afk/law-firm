import type {
  ConflictCheckResult,
  IntakeSource,
  IntakeStatus,
  Prisma,
  RejectionReason,
  UserRole,
} from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";
import { isManagement } from "@/lib/rbac";

export const INTAKE_STATUS_LABELS_AR: Record<IntakeStatus, string> = {
  received: "استقبال",
  conflict_check: "فحص تعارض",
  under_assessment: "قيد التقييم",
  fee_agreement_pending: "بانتظار العقد",
  accepted: "مقبولة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

export const INTAKE_STATUS_STYLES: Record<IntakeStatus, string> = {
  received: "bg-gray-200 text-gray-700",
  conflict_check: "bg-blue-100 text-blue-700",
  under_assessment: "bg-purple-100 text-purple-700",
  fee_agreement_pending: "bg-orange-100 text-orange-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export const INTAKE_SOURCE_LABELS_AR: Record<IntakeSource, string> = {
  referral_client: "إحالة من عميل",
  referral_lawyer: "إحالة من محامٍ آخر",
  website: "الموقع الإلكتروني",
  advertisement: "إعلان",
  personal_network: "علاقات شخصية",
  walk_in: "حضور مباشر",
  other: "أخرى",
};

export const CONFLICT_RESULT_LABELS_AR: Record<ConflictCheckResult, string> = {
  pending: "لم يُفحص بعد",
  clear: "لا يوجد تعارض",
  potential: "تعارض محتمل",
  confirmed: "تعارض مؤكد",
};

export const CONFLICT_RESULT_STYLES: Record<ConflictCheckResult, string> = {
  pending: "bg-gray-100 text-gray-600",
  clear: "bg-emerald-100 text-emerald-700",
  potential: "bg-orange-100 text-orange-700",
  confirmed: "bg-red-100 text-red-700",
};

export const REJECTION_REASON_LABELS_AR: Record<RejectionReason, string> = {
  conflict_of_interest: "تعارض مصالح",
  outside_expertise: "خارج التخصص",
  weak_legal_position: "ضعف الموقف القانوني",
  fee_disagreement: "خلاف على الأتعاب",
  client_withdrew: "انسحاب العميل",
  capacity: "عدم توفر طاقة",
  other: "أخرى",
};

/** مراحل شريط التقدم في صفحة تفاصيل الطلب. */
export const INTAKE_STAGES: { key: string; label: string }[] = [
  { key: "received", label: "استقبال" },
  { key: "conflict", label: "تعارض" },
  { key: "assessment", label: "تقييم" },
  { key: "fee", label: "عقد" },
  { key: "case", label: "قضية" },
];

/** ترتيب المرحلة النشطة (1..5) حسب حالة الطلب. */
export function intakeStageIndex(status: IntakeStatus): number {
  switch (status) {
    case "received":
      return 1;
    case "conflict_check":
      return 2;
    case "under_assessment":
      return 3;
    case "fee_agreement_pending":
      return 4;
    case "accepted":
      return 5;
    default:
      return 0; // rejected / cancelled
  }
}

// ── الصلاحيات ──────────────────────────────────────────────

/** التقييم والقرار والتفعيل: مسؤول النظام فقط. */
export function canAssessIntake(role: UserRole): boolean {
  return role === "system_admin";
}
export const canDecideIntake = canAssessIntake;
export const canActivateIntake = canAssessIntake;

/** بنك الرفضات: مسؤول النظام والمشرف. */
export function canViewRejectedBank(role: UserRole): boolean {
  return role === "system_admin" || role === "supervisor";
}

/**
 * رؤية طلبات الاستلام:
 * - مسؤول النظام والمشرف: الكل.
 * - غيرهم: فقط الطلبات التي استقبلوها.
 */
export function intakeVisibilityWhere(user: SessionUser): Prisma.IntakeRequestWhereInput {
  if (isManagement(user.role) || user.role === "supervisor") return {};
  return { receivedById: user.id };
}

/** هل يستطيع المستخدم فتح طلب استلام محدّد؟ */
export function canAccessIntake(
  user: SessionUser,
  intake: { receivedById: string }
): boolean {
  return isManagement(user.role) || user.role === "supervisor" || intake.receivedById === user.id;
}
