// تشكيل فريق القضية: الأدوار، التسميات، والتحقق من صحة التشكيل.
// ملف نقيّ (بلا خادم) يُستورد في الواجهة والـ APIs.
import type { CaseTeamRole } from "@prisma/client";

export const TEAM_ROLE_LABELS_AR: Record<CaseTeamRole, string> = {
  lead_supervisor: "المشرف الرئيسي",
  co_supervisor: "مشرف مساعد",
  lead_lawyer: "المحامي الرئيسي",
  co_lawyer: "محامٍ مساعد",
  researcher: "باحث قانوني",
};

export const TEAM_ROLE_ICONS: Record<CaseTeamRole, string> = {
  lead_supervisor: "🏛️",
  co_supervisor: "🏛️",
  lead_lawyer: "⚖️",
  co_lawyer: "⚖️",
  researcher: "📚",
};

/** الأدوار التي يُشتقّ منها من يراجع/يعتمد المذكرات ويتولّى القرار في القضية. */
export const CASE_LAWYER_TEAM_ROLES: CaseTeamRole[] = ["lead_lawyer", "co_lawyer"];
export const CASE_SUPERVISOR_TEAM_ROLES: CaseTeamRole[] = ["lead_supervisor", "co_supervisor"];
/** من يراجع المذكرات: المحامون والمشرفون في الفريق. */
export const MEMO_REVIEWER_TEAM_ROLES: CaseTeamRole[] = [
  ...CASE_LAWYER_TEAM_ROLES,
  ...CASE_SUPERVISOR_TEAM_ROLES,
];

/** مدخلات تشكيل الفريق من الواجهة. */
export type TeamInput = {
  supervisorId?: string | null; // اختياري
  leadLawyerId: string; // إلزامي، واحد
  coLawyerIds?: string[]; // عدد مفتوح
  researcherIds?: string[]; // عدد مفتوح
};

export type TeamMemberSpec = { userId: string; roleInCase: CaseTeamRole };

export class TeamValidationError extends Error {}

function dedupe(ids: readonly string[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()))];
}

/**
 * يبني قائمة أعضاء الفريق من مدخلات التشكيل مع التحقق:
 *  - المحامي الرئيسي إلزامي.
 *  - لا يتكرر الشخص نفسه في أكثر من دور.
 * يرمي TeamValidationError برسالة عربية عند الفشل.
 */
export function buildTeamMembers(team: TeamInput): TeamMemberSpec[] {
  const leadLawyerId = team.leadLawyerId?.trim();
  if (!leadLawyerId) throw new TeamValidationError("المحامي الرئيسي إلزامي");

  const supervisorId = team.supervisorId?.trim() || null;
  const coLawyerIds = dedupe(team.coLawyerIds);
  const researcherIds = dedupe(team.researcherIds);

  const members: TeamMemberSpec[] = [];
  const seen = new Set<string>();
  const add = (userId: string, roleInCase: CaseTeamRole) => {
    if (seen.has(userId)) {
      throw new TeamValidationError("لا يمكن أن يظهر الشخص نفسه في أكثر من دور داخل الفريق");
    }
    seen.add(userId);
    members.push({ userId, roleInCase });
  };

  if (supervisorId) add(supervisorId, "lead_supervisor");
  add(leadLawyerId, "lead_lawyer");
  for (const id of coLawyerIds) add(id, "co_lawyer");
  for (const id of researcherIds) add(id, "researcher");

  return members;
}
