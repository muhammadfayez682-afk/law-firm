import type { CaseOutcome, CaseStatus, ClosureReason } from "@prisma/client";

export const CASE_OUTCOME_LABELS_AR: Record<CaseOutcome, string> = {
  won_full: "كسب كامل",
  won_partial: "كسب جزئي",
  lost: "خسارة",
  settled: "صلح",
  withdrawn: "سحب الدعوى",
  dismissed: "رُفضت شكلاً",
  client_terminated: "إنهاء التوكيل",
};

export const CLOSURE_REASON_LABELS_AR: Record<ClosureReason, string> = {
  final_judgment: "حكم نهائي",
  settlement: "تسوية",
  withdrawal: "تنازل الموكل",
  agency_revoked: "إلغاء وكالة",
  statute_barred: "سقوط بالتقادم",
  other: "أخرى",
};

const WINNING_OUTCOMES: CaseOutcome[] = ["won_full", "won_partial"];

export function isWinningOutcome(outcome: CaseOutcome): boolean {
  return WINNING_OUTCOMES.includes(outcome);
}

type CaseTeamAccessInput = {
  responsibleLawyerId: string;
  team: { userId: string }[];
};

/** المحامي المسؤول أو أي عضو في فريق القضية يمكنه تقديم طلب إغلاق. */
export function canRequestCaseClosure(
  userId: string,
  caseData: CaseTeamAccessInput
): boolean {
  return (
    caseData.responsibleLawyerId === userId ||
    caseData.team.some((member) => member.userId === userId)
  );
}

/** القضية يجب ألا تكون مغلقة أو مؤرشفة أو بانتظار اعتماد إغلاق مسبق. */
export function canTransitionToPendingClosure(status: CaseStatus): boolean {
  return status !== "pending_closure" && status !== "closed" && status !== "archived";
}

export function validateClosureRequestInput(input: {
  outcome?: unknown;
  closureReason?: unknown;
  closureNotes?: unknown;
}): string | null {
  if (typeof input.outcome !== "string" || !(input.outcome in CASE_OUTCOME_LABELS_AR)) {
    return "نتيجة القضية مطلوبة";
  }
  if (typeof input.closureReason !== "string" || !(input.closureReason in CLOSURE_REASON_LABELS_AR)) {
    return "سبب الإغلاق مطلوب";
  }
  if (typeof input.closureNotes !== "string" || !input.closureNotes.trim()) {
    return "ملخص النتيجة مطلوب";
  }
  return null;
}

/**
 * الحالة التي تعود إليها القضية عند رفض طلب الإغلاق. لا يوجد حقل يحفظ الحالة
 * السابقة بالضبط في CaseClosureRequest، لذا — بنفس منطق إعادة الفتح — تعود
 * القضية لحالة نشطة عامة (in_progress) بدل استرجاع حالتها الدقيقة قبل الطلب.
 */
export const CASE_ACTIVE_STATUS_AFTER_REJECTION: CaseStatus = "in_progress";

/** حالة القضية بعد إعادة الفتح — دائمًا in_progress بصرف النظر عن حالتها قبل الإغلاق. */
export const CASE_STATUS_AFTER_REOPEN: CaseStatus = "in_progress";
