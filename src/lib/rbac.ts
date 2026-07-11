import type { Prisma, UserRole, DocumentVisibility } from "@prisma/client";

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  partner: "شريك",
  senior_lawyer: "محامٍ أول",
  lawyer: "محامٍ",
  secretary: "سكرتير",
  accountant: "محاسب",
};

export type SessionUser = {
  id: string;
  role: UserRole;
};

type CaseAccessInput = {
  responsibleLawyerId: string;
  team: { userId: string }[];
  accessOverrides: { userId: string; accessType: "allow" | "deny" }[];
};

const MANAGEMENT_ROLES: UserRole[] = ["partner", "senior_lawyer"];

export function isManagement(role: UserRole): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/** اعتماد/رفض إغلاق القضية وإعادة فتحها صلاحية حصرية للشريك، أضيق من isManagement. */
export function isPartner(role: UserRole): boolean {
  return role === "partner";
}

/** الشركاء والمحامون الأوائل يرون كل القضايا؛ غيرهم يحتاج عضوية الفريق أو تفويض صريح، مع احترام DENY صريح دائمًا. */
export function canAccessCase(user: SessionUser, caseData: CaseAccessInput): boolean {
  const override = caseData.accessOverrides.find((o) => o.userId === user.id);
  if (override?.accessType === "deny") return false;
  if (override?.accessType === "allow") return true;

  if (isManagement(user.role)) return true;
  if (caseData.responsibleLawyerId === user.id) return true;
  if (caseData.team.some((member) => member.userId === user.id)) return true;

  return false;
}

/** شرط Prisma لتقييد رؤية القضايا يطابق منطق canAccessCase — يُستخدم عند الاستعلام مباشرة من قاعدة البيانات. */
export function caseVisibilityWhere(user: SessionUser): Prisma.CaseWhereInput {
  if (isManagement(user.role)) return {};

  return {
    AND: [
      { NOT: { accessOverrides: { some: { userId: user.id, accessType: "deny" } } } },
      {
        OR: [
          { responsibleLawyerId: user.id },
          { team: { some: { userId: user.id } } },
          { accessOverrides: { some: { userId: user.id, accessType: "allow" } } },
        ],
      },
    ],
  };
}

/**
 * رؤية العملاء:
 * - الشريك/المحامي الأول (الإدارة): كل العملاء.
 * - المحاسب: كل العملاء (لأغراض الفوترة) لكن دون تفاصيل القضايا (تُخفى في الواجهة).
 * - غيرهم: فقط عملاء القضايا التي يملك المستخدم صلاحية رؤيتها (عضوية فريق/تفويض).
 */
export function clientVisibilityWhere(user: SessionUser): Prisma.ClientWhereInput {
  if (isManagement(user.role) || user.role === "accountant") return {};
  return { cases: { some: caseVisibilityWhere(user) } };
}

/** فحص صلاحية عميل واحد — يطابق clientVisibilityWhere لكن على كائن محمّل مسبقًا. */
export function canAccessClient(
  user: SessionUser,
  client: { cases: CaseAccessInput[] }
): boolean {
  if (isManagement(user.role) || user.role === "accountant") return true;
  return client.cases.some((c) => canAccessCase(user, c));
}

export function canCreateCase(role: UserRole): boolean {
  return role === "partner" || role === "senior_lawyer" || role === "lawyer";
}

export function canEditCase(user: SessionUser, caseData: CaseAccessInput): boolean {
  if (!canAccessCase(user, caseData)) return false;
  return user.role !== "accountant";
}

export function canManageInvoices(role: UserRole): boolean {
  return role === "partner" || role === "accountant";
}

/** إدارة المستخدمين وسجل التدقيق صلاحية حصرية للشريك. */
export function canManageUsers(role: UserRole): boolean {
  return role === "partner";
}

export function canViewAuditLog(role: UserRole): boolean {
  return role === "partner";
}

export function canManageTemplates(role: UserRole): boolean {
  return role === "partner" || role === "senior_lawyer";
}

export function canViewDocument(
  user: SessionUser,
  visibilityLevel: DocumentVisibility,
  caseData: CaseAccessInput | null
): boolean {
  if (visibilityLevel === "all_staff") return true;
  if (visibilityLevel === "partners_only") return user.role === "partner";
  if (!caseData) return isManagement(user.role);
  return canAccessCase(user, caseData);
}

export function canUploadDocuments(role: UserRole): boolean {
  return role !== "accountant";
}
