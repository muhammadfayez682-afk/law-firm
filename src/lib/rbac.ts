import type { Prisma, UserRole, DocumentVisibility } from "@prisma/client";

export const ROLE_LABELS_AR: Record<UserRole, string> = {
  system_admin: "مسؤول النظام",
  supervisor: "مشرف",
  lawyer: "محامٍ",
  researcher: "باحث قانوني",
  secretary: "سكرتير",
  accountant: "محاسب",
};

/** الأدوار التي تتولّى القضايا فعليًا (تُسند إليها كمحامٍ مسؤول وتظهر في تقارير الأداء). */
export const CASE_HANDLER_ROLES: UserRole[] = ["system_admin", "supervisor", "lawyer"];

export type SessionUser = {
  id: string;
  role: UserRole;
};

type CaseAccessInput = {
  responsibleLawyerId: string;
  team: { userId: string }[];
  accessOverrides: { userId: string; accessType: "allow" | "deny" }[];
};

// مسؤول النظام فقط يملك رؤية شاملة لكل القضايا؛ بقية الأدوار عبر عضوية الفريق أو تفويض.
const MANAGEMENT_ROLES: UserRole[] = ["system_admin"];

export function isManagement(role: UserRole): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/** اعتماد/رفض إغلاق القضية وإعادة فتحها وإدارة المستخدمين صلاحية حصرية لمسؤول النظام. */
export function isSystemAdmin(role: UserRole): boolean {
  return role === "system_admin";
}

/** مسؤول النظام يرى كل القضايا؛ غيره يحتاج أن يكون محاميًا مسؤولًا، أو عضو فريق، أو صاحب تفويض allow، مع احترام DENY صريح. */
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
  // القضايا المحذوفة (حذف ناعم) تُستبعد من كل الاستعلامات المرئية.
  if (isManagement(user.role)) return { deletedAt: null };

  return {
    deletedAt: null,
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
 * - مسؤول النظام: كل العملاء.
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
  return role === "system_admin" || role === "supervisor" || role === "lawyer";
}

export function canEditCase(user: SessionUser, caseData: CaseAccessInput): boolean {
  if (!canAccessCase(user, caseData)) return false;
  return user.role !== "accountant";
}

export function canManageInvoices(role: UserRole): boolean {
  return role === "system_admin" || role === "accountant";
}

/** إدارة المستخدمين وسجل التدقيق صلاحية حصرية لمسؤول النظام. */
export function canManageUsers(role: UserRole): boolean {
  return role === "system_admin";
}

export function canViewAuditLog(role: UserRole): boolean {
  return role === "system_admin";
}

export function canManageTemplates(role: UserRole): boolean {
  return role === "system_admin" || role === "supervisor";
}

export function canViewDocument(
  user: SessionUser,
  visibilityLevel: DocumentVisibility,
  caseData: CaseAccessInput | null
): boolean {
  if (visibilityLevel === "all_staff") return true;
  if (visibilityLevel === "partners_only") return user.role === "system_admin";
  if (!caseData) return isManagement(user.role);
  return canAccessCase(user, caseData);
}

export function canUploadDocuments(role: UserRole): boolean {
  return role !== "accountant";
}
