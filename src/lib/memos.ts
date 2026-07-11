import type { MemoStatus, Prisma, UserRole } from "@prisma/client";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";

export const MEMO_STATUS_LABELS_AR: Record<MemoStatus, string> = {
  draft: "مسودة",
  submitted: "مُرسلة للمراجعة",
  changes_requested: "تعديلات مطلوبة",
  approved: "معتمدة",
  submitted_to_court: "قُدّمت للمحكمة",
};

export const MEMO_STATUS_STYLES: Record<MemoStatus, string> = {
  draft: "bg-gray-200 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  changes_requested: "bg-orange-100 text-orange-700",
  approved: "bg-emerald-100 text-emerald-700",
  submitted_to_court: "bg-purple-100 text-purple-700",
};

export const MEMO_TYPE_OPTIONS = [
  "مذكرة دفاع",
  "مذكرة رد",
  "مذكرة تعقيب",
  "مذكرة استئناف",
];

/** الباحث القانوني (ومسؤول النظام) يكتب المذكرات. */
export function canAuthorMemo(role: UserRole): boolean {
  return role === "researcher" || role === "system_admin";
}

/** المحامي (ومسؤول النظام) يراجع ويعتمد المذكرات. */
export function canReviewMemo(role: UserRole): boolean {
  return role === "lawyer" || role === "system_admin";
}

/** الباحث يعدّل مذكرته فقط وهي مسودة أو مُعادة لطلب تعديلات. */
export function canEditMemo(
  user: SessionUser,
  memo: { authoredById: string; status: MemoStatus }
): boolean {
  if (user.role === "system_admin") return true;
  if (memo.authoredById !== user.id) return false;
  return memo.status === "draft" || memo.status === "changes_requested";
}

/** المذكرات المرئية = مذكرات القضايا التي يراها المستخدم. */
export function memoVisibilityWhere(user: SessionUser): Prisma.LegalMemoWhereInput {
  return { case: caseVisibilityWhere(user) };
}
