import type { CaseStatus } from "@prisma/client";
import { isSystemAdmin, type SessionUser } from "@/lib/rbac";

// الحالات التي يجوز الأرشفة منها (منتهية فعليًا).
export const ARCHIVABLE_STATUSES: CaseStatus[] = ["closed", "settled_amicably"];

// أيام الانتظار قبل السماح بالحذف النهائي بعد الأرشفة.
export const DELETE_MIN_ARCHIVE_DAYS = 90;
// أيام الأمان بعد الحذف الناعم قبل الحذف الفعلي عبر الكرون.
export const SOFT_DELETE_GRACE_DAYS = 30;

export const ARCHIVE_REASON_OPTIONS = [
  "انتهت القضية بحكم نهائي",
  "أُغلقت بصلح",
  "لا حاجة للوصول اليومي",
  "نقل للأرشيف الدائم",
  "أخرى",
] as const;

type ArchiveCaseInput = {
  status: CaseStatus;
  responsibleLawyerId: string;
};

/** هل يمكن أرشفة القضية في حالتها الحالية؟ */
export function canArchiveStatus(status: CaseStatus): boolean {
  return ARCHIVABLE_STATUSES.includes(status);
}

/** من يؤرشف: مسؤول النظام/المشرف أي قضية مؤهّلة؛ المحامي المسؤول قضاياه فقط. */
export function canArchiveCase(user: SessionUser, caseData: ArchiveCaseInput): boolean {
  if (!canArchiveStatus(caseData.status)) return false;
  if (user.role === "system_admin" || user.role === "supervisor") return true;
  return user.role === "lawyer" && caseData.responsibleLawyerId === user.id;
}

/** الاسترجاع من الأرشيف: مسؤول النظام والمشرف فقط. */
export function canRestoreCase(user: SessionUser): boolean {
  return user.role === "system_admin" || user.role === "supervisor";
}

export type DeleteEligibility = { allowed: boolean; reason?: string };

/**
 * الحذف النهائي (لمسؤول النظام فقط) بضوابط صارمة:
 *  - القضية مؤرشفة.
 *  - لم تُعقد جلسات (held).
 *  - لا فواتير مدفوعة.
 *  - مضى ≥ 90 يومًا على الأرشفة.
 */
export function checkDeleteEligibility(
  user: SessionUser,
  caseData: {
    status: CaseStatus;
    archivedAt: Date | string | null;
    heldSessionsCount: number;
    paidInvoicesCount: number;
  }
): DeleteEligibility {
  if (!isSystemAdmin(user.role)) return { allowed: false, reason: "الحذف النهائي متاح لمسؤول النظام فقط" };
  if (caseData.status !== "archived" || !caseData.archivedAt) {
    return { allowed: false, reason: "الحذف متاح للقضايا المؤرشفة فقط" };
  }
  if (caseData.heldSessionsCount > 0) {
    return { allowed: false, reason: "لا يمكن حذف قضية عُقدت فيها جلسات" };
  }
  if (caseData.paidInvoicesCount > 0) {
    return { allowed: false, reason: "لا يمكن حذف قضية لها فواتير مدفوعة" };
  }
  const days = (Date.now() - new Date(caseData.archivedAt).getTime()) / (24 * 3600 * 1000);
  if (days < DELETE_MIN_ARCHIVE_DAYS) {
    return { allowed: false, reason: `يجب مرور ${DELETE_MIN_ARCHIVE_DAYS} يومًا على الأرشفة (مضى ${Math.floor(days)} يومًا)` };
  }
  return { allowed: true };
}
