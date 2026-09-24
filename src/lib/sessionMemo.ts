// أدوات مذكرة الجلسة (ربط المذكرة اختياري — «بانتظار المذكرة» مؤشّر بصري فقط).
import type { CaseTeamRole } from "@prisma/client";
import { MEMO_REVIEWER_TEAM_ROLES } from "@/lib/caseTeam";

/** جلسة منعقدة بلا مذكرة = «بانتظار المذكرة» (مؤشّر بصري، لا يمنع الحفظ). */
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
