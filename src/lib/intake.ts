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

/**
 * حفظ دراسة التقييم:
 * - مسؤول النظام والمشرف دائمًا.
 * - المُفوَّض إليه التقييم (assessmentDelegatedToId) — يعمل التقييم فقط دون القرار.
 */
export function canAssessIntake(
  user: SessionUser,
  intake: { assessmentDelegatedToId?: string | null }
): boolean {
  return (
    user.role === "system_admin" ||
    user.role === "supervisor" ||
    intake.assessmentDelegatedToId === user.id
  );
}

/** القرار (قبول/رفض) والتفعيل: مسؤول النظام والمشرف فقط — لا يملكهما المُفوَّض. */
export function canDecideIntake(role: UserRole): boolean {
  return role === "system_admin" || role === "supervisor";
}
export const canActivateIntake = canDecideIntake;

/** اعتماد دراسة التقييم (بوّابة إلزامية للتفعيل): مسؤول النظام فقط. */
export function canApproveAssessment(role: UserRole): boolean {
  return role === "system_admin";
}

/** الحقول الإلزامية الأربعة في دراسة التقييم (بأسمائها العربية). */
export const ASSESSMENT_MANDATORY_FIELDS = [
  { key: "legalBasis", label: "التكييف القانوني" },
  { key: "jurisdiction", label: "الاختصاص القضائي" },
  { key: "strengths", label: "نقاط القوة" },
  { key: "weaknesses", label: "نقاط الضعف" },
] as const;

/** حقل نصّي «معبّأ فعليًا»: ليس فارغًا وليس "0" (قيمة نائبة تعني الفراغ). */
export function isMeaningfullyFilled(v: unknown): boolean {
  if (typeof v !== "string") return v != null && v !== "";
  const t = v.trim();
  return t !== "" && t !== "0";
}

/** أسماء الحقول الإلزامية الناقصة (غير المعبّأة فعليًا) في تقييم الطلب. */
export function assessmentMissingFields(intake: {
  legalBasis?: string | null;
  jurisdiction?: string | null;
  strengths?: string | null;
  weaknesses?: string | null;
}): string[] {
  const rec = intake as Record<string, unknown>;
  return ASSESSMENT_MANDATORY_FIELDS.filter((f) => !isMeaningfullyFilled(rec[f.key])).map((f) => f.label);
}

/** تفويض التقييم لموظف آخر: مسؤول النظام والمشرف. */
export function canDelegateAssessment(role: UserRole): boolean {
  return role === "system_admin" || role === "supervisor";
}

/** بنك الرفضات: مسؤول النظام والمشرف. */
export function canViewRejectedBank(role: UserRole): boolean {
  return role === "system_admin" || role === "supervisor";
}

/**
 * رؤية طلبات الاستلام:
 * - مسؤول النظام والمشرف: الكل.
 * - غيرهم: الطلبات التي استقبلوها أو فُوِّض إليهم تقييمها.
 */
export function intakeVisibilityWhere(user: SessionUser): Prisma.IntakeRequestWhereInput {
  if (isManagement(user.role) || user.role === "supervisor") return {};
  return { OR: [{ receivedById: user.id }, { assessmentDelegatedToId: user.id }] };
}

/** هل يستطيع المستخدم فتح طلب استلام محدّد؟ */
export function canAccessIntake(
  user: SessionUser,
  intake: { receivedById: string; assessmentDelegatedToId?: string | null }
): boolean {
  return (
    isManagement(user.role) ||
    user.role === "supervisor" ||
    intake.receivedById === user.id ||
    intake.assessmentDelegatedToId === user.id
  );
}
