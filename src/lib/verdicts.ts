// الوحدة الختامية للقضية: صك الحكم + القطعية + سبب الإغلاق المتعدد (منطق + تسميات).
import type {
  CaseType,
  VerdictDegree,
  VerdictResult,
  VerdictFinality,
  CaseClosureReason,
  ClosureReason,
} from "@prisma/client";
import { isSystemAdmin, canPerformOnCase, type SessionUser, type CasePermissionInput } from "@/lib/rbac";
import { isCourtWorkingDay } from "@/lib/judicialCalendar";

export const VERDICT_DEGREE_LABELS_AR: Record<VerdictDegree, string> = {
  first_instance: "ابتدائي",
  appeal: "استئناف",
  supreme: "عليا",
};

export const VERDICT_RESULT_LABELS_AR: Record<VerdictResult, string> = {
  in_favor: "لصالحنا",
  against: "ضدنا",
  partial: "جزئي",
};

export const VERDICT_FINALITY_LABELS_AR: Record<VerdictFinality, string> = {
  pending_finality: "بانتظار القطعية",
  final_binding: "مكتسب القطعية",
};

export const CASE_CLOSURE_REASON_LABELS_AR: Record<CaseClosureReason, string> = {
  verdict: "حكم",
  settlement: "صلح",
  withdrawal: "تنازل",
  dismissal: "شطب",
};

/**
 * المدة النظامية لمهلة الاستئناف بالأيام (تقويمية) حسب نوع القضية.
 * ⚠️ قيم مبدئية قابلة للتعديل — راجعها مقابل الأنظمة السارية:
 *  - عمالي: 15 يومًا (المحاكم العمالية).
 *  - تجاري: 30 يومًا (والدعاوى المستعجلة 15 — تُعدَّل يدويًا عند اللزوم).
 *  - البقية: 30 يومًا افتراضيًا.
 * المحامي يستطيع تعديل `Case.appealDeadline` يدويًا لاحقًا (الحقل غير مقفل).
 */
export const APPEAL_PERIOD_DAYS: Record<CaseType, number> = {
  general: 30,
  commercial: 30,
  labor: 15,
  personal_status: 30,
  criminal: 30,
  administrative: 30,
  committee: 30,
  arbitration: 30,
  debt_collection: 30,
  other: 30,
};

/**
 * يحسب تاريخ مهلة الاستئناف = تاريخ الحكم + المدة النظامية (أيام تقويمية)،
 * وإن صادف اليوم الأخير عطلة رسمية/نهاية أسبوع يُمدّ لأول يوم عمل (نمط مهل التسوية).
 */
export function computeAppealDeadline(caseType: CaseType, verdictDate: Date): Date {
  const days = APPEAL_PERIOD_DAYS[caseType] ?? 30;
  const d = new Date(verdictDate);
  d.setDate(d.getDate() + days);
  // تمديد إلى أول يوم عمل إن وقع الأجل في عطلة/نهاية أسبوع.
  let guard = 0;
  while (!isCourtWorkingDay(d) && guard < 30) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

export function isVerdictDegree(v: unknown): v is VerdictDegree {
  return v === "first_instance" || v === "appeal" || v === "supreme";
}
export function isVerdictResult(v: unknown): v is VerdictResult {
  return v === "in_favor" || v === "against" || v === "partial";
}
export function isCaseClosureReason(v: unknown): v is CaseClosureReason {
  return v === "verdict" || v === "settlement" || v === "withdrawal" || v === "dismissal";
}

/**
 * صلاحية كتابة/تعديل صك الحكم:
 * مسؤول النظام، أو من يملك edit_case على القضية (المحامي الرئيسي/الفريق المخوّل) — عدا الباحث (عرض فقط).
 */
export function canWriteVerdict(user: SessionUser, caseData: CasePermissionInput): boolean {
  if (isSystemAdmin(user.role)) return true;
  if (user.role === "researcher") return false;
  return canPerformOnCase(user, caseData, "edit_case");
}

/** خريطة سبب الإغلاق الجديد → القديم (للتوافق مع CaseClosureRequest.closureReason). */
const NEW_TO_OLD_CLOSURE_REASON: Record<CaseClosureReason, ClosureReason> = {
  verdict: "final_judgment",
  settlement: "settlement",
  withdrawal: "withdrawal",
  dismissal: "other",
};
export function mapClosureReasonToOld(reason: CaseClosureReason): ClosureReason {
  return NEW_TO_OLD_CLOSURE_REASON[reason];
}

export type ClosureRequirementContext = {
  hasFinalBindingVerdict: boolean; // يوجد صك مكتسب القطعية على القضية
  hasSettledSettlement: boolean; // تسوية ودية بنتيجة settled
};

/**
 * متطلّب كل سبب إغلاق — يُعيد رسالة خطأ إن لم يُستوفَ، أو null.
 * verdict: يتطلب صكًا مكتسب القطعية. settlement: تسوية موثّقة أو ملاحظة. withdrawal/dismissal: ملاحظة.
 */
export function closureRequirementError(
  reason: CaseClosureReason,
  closureNote: string | null | undefined,
  ctx: ClosureRequirementContext
): string | null {
  const hasNote = typeof closureNote === "string" && closureNote.trim().length > 0;
  switch (reason) {
    case "verdict":
      return ctx.hasFinalBindingVerdict
        ? null
        : "لا يمكن الإغلاق بحكم قبل اكتساب القطعية — سجّل صك حكم مكتسب القطعية على القضية أولًا.";
    case "settlement":
      return ctx.hasSettledSettlement || hasNote
        ? null
        : "الإغلاق بصلح يتطلب تسوية ودية موثّقة (نتيجتها «تمّت»)، أو ملاحظة توثّق اتفاق الصلح.";
    case "withdrawal":
      return hasNote ? null : "الإغلاق بتنازل يتطلب ملاحظة توثّق تنازل الموكل.";
    case "dismissal":
      return hasNote ? null : "الإغلاق بالشطب يتطلب ملاحظة موجزة بالسبب الإجرائي.";
    default:
      return "سبب الإغلاق مطلوب";
  }
}
