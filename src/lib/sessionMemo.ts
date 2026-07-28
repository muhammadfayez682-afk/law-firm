// إلزام ربط مذكرة بالجلسة المنعقدة.
import type { CaseTeamRole } from "@prisma/client";
import { MEMO_REVIEWER_TEAM_ROLES } from "@/lib/caseTeam";

/** رسالة رفض إغلاق محضر جلسة منعقدة دون مذكرة. */
export const SESSION_MEMO_REQUIRED_MESSAGE =
  "لا يمكن إغلاق محضر جلسة منعقدة دون ربط مذكرة. اكتب المذكرة أو اربط مذكرة موجودة أولاً.";

/** جلسة منعقدة بلا مذكرة = «بانتظار المذكرة». */
export function isSessionAwaitingMemo(s: { status: string; memoId: string | null }): boolean {
  return s.status === "held" && !s.memoId;
}

/** المحامون «الحاضرون» = محامو/مشرفو فريق القضية + المحامي المسؤول. */
export function attendingLawyerIds(caseData: {
  responsibleLawyerId: string;
  team: { userId: string; roleInCase: CaseTeamRole }[];
}): string[] {
  const ids = new Set<string>([caseData.responsibleLawyerId]);
  for (const m of caseData.team) {
    if (MEMO_REVIEWER_TEAM_ROLES.includes(m.roleInCase)) ids.add(m.userId);
  }
  return [...ids];
}
