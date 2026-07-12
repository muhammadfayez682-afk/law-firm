import type { PartyRole } from "@prisma/client";

export const PARTY_ROLE_LABELS_AR: Record<PartyRole, string> = {
  plaintiff: "مدعي",
  defendant: "مدعى عليه",
  appellant: "مستأنف",
  appellee: "مستأنف ضده",
  petitioner: "مقدم الطلب",
  respondent: "مدعى عليه (إداري)",
  third_party: "طرف ثالث",
};

/** صفة الطرف المقابل مقابل صفة موكّلنا (تُملأ تلقائيًا). */
export const OPPOSING_ROLE: Record<PartyRole, PartyRole> = {
  plaintiff: "defendant",
  defendant: "plaintiff",
  appellant: "appellee",
  appellee: "appellant",
  petitioner: "respondent",
  respondent: "petitioner",
  third_party: "third_party",
};

/** الصفات المتاحة لاختيار صفة موكّلنا (يستبعد third_party كصفة رئيسية). */
export const CLIENT_PARTY_ROLE_OPTIONS: PartyRole[] = [
  "plaintiff",
  "defendant",
  "appellant",
  "appellee",
  "petitioner",
  "respondent",
];

export function partyRoleLabel(role: PartyRole | null | undefined): string {
  return role ? PARTY_ROLE_LABELS_AR[role] : "—";
}

/** لون شارة الصفة (أخضر لموكّلنا يُعالج في المكوّن؛ هذه ألوان الصفة العامة). */
export const PARTY_ROLE_BADGE_STYLE: Record<PartyRole, string> = {
  plaintiff: "bg-blue-100 text-blue-700",
  defendant: "bg-amber-100 text-amber-700",
  appellant: "bg-indigo-100 text-indigo-700",
  appellee: "bg-orange-100 text-orange-700",
  petitioner: "bg-blue-100 text-blue-700",
  respondent: "bg-amber-100 text-amber-700",
  third_party: "bg-gray-100 text-gray-600",
};
