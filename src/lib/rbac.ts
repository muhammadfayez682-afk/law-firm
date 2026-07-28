import type { Prisma, UserRole, DocumentVisibility, DelegatedPermission } from "@prisma/client";

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

/** تفويض فعّال يكفي لمنح رؤية القضية (النوع المصغّر المطلوب في canAccessCase). */
type DelegationLite = {
  grantedToId: string;
  revokedAt: Date | null;
  expiresAt: Date;
};

type CaseAccessInput = {
  responsibleLawyerId: string;
  createdById?: string | null; // مُنشئ القضية (أساس manage_timeline) — يُحمَّل عند الحاجة فقط
  team: { userId: string }[];
  accessOverrides: { userId: string; accessType: "allow" | "deny" }[];
  // اختياري: عند تحميله، تُمنح الرؤية أيضًا لأصحاب التفويضات الفعّالة (يجب أن يُحمَّل
  // في صفحة تفاصيل القضية لإبقاء canAccessCase متزامنًا مع caseVisibilityWhere).
  delegations?: DelegationLite[];
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

function isDenied(userId: string, overrides: { userId: string; accessType: "allow" | "deny" }[]): boolean {
  return overrides.some((o) => o.userId === userId && o.accessType === "deny");
}

/** رؤية القضية بحكم الوضع المباشر (تجاوز/إدارة/محامٍ مسؤول/عضوية فريق) — دون النظر إلى التفويضات. */
function hasDirectCaseAccess(user: SessionUser, caseData: CaseAccessInput): boolean {
  const override = caseData.accessOverrides.find((o) => o.userId === user.id);
  if (override?.accessType === "deny") return false;
  if (override?.accessType === "allow") return true;
  if (isManagement(user.role)) return true;
  if (caseData.responsibleLawyerId === user.id) return true;
  return caseData.team.some((member) => member.userId === user.id);
}

/** هل للمستخدم تفويض فعّال (غير ملغى وغير منتهٍ) على القضية؟ (رؤية فقط — بلا نظر لنوع الصلاحية). */
function hasActiveDelegation(userId: string, delegations?: DelegationLite[]): boolean {
  if (!delegations) return false;
  const now = Date.now();
  return delegations.some(
    (d) => d.grantedToId === userId && d.revokedAt == null && new Date(d.expiresAt).getTime() > now
  );
}

/**
 * مسؤول النظام يرى كل القضايا؛ غيره يحتاج أن يكون محاميًا مسؤولًا، أو عضو فريق، أو صاحب تفويض allow،
 * أو صاحب **تفويض صلاحية فعّال** على القضية — مع احترام DENY صريح (يتفوّق على التفويض دائمًا).
 * ⚠️ منطق التفويض هنا يجب أن يطابق فرع التفويض في caseVisibilityWhere (القاعدة الذهبية).
 */
export function canAccessCase(user: SessionUser, caseData: CaseAccessInput): boolean {
  if (isDenied(user.id, caseData.accessOverrides)) return false; // DENY يتفوّق حتى على التفويض
  if (hasDirectCaseAccess(user, caseData)) return true;
  return hasActiveDelegation(user.id, caseData.delegations);
}

/** شرط Prisma لتقييد رؤية القضايا يطابق منطق canAccessCase — يُستخدم عند الاستعلام مباشرة من قاعدة البيانات. */
export function caseVisibilityWhere(user: SessionUser): Prisma.CaseWhereInput {
  // القضايا المحذوفة (حذف ناعم) تُستبعد من كل الاستعلامات المرئية.
  if (isManagement(user.role)) return { deletedAt: null };

  const now = new Date();
  return {
    deletedAt: null,
    AND: [
      { NOT: { accessOverrides: { some: { userId: user.id, accessType: "deny" } } } },
      {
        OR: [
          { responsibleLawyerId: user.id },
          { team: { some: { userId: user.id } } },
          { accessOverrides: { some: { userId: user.id, accessType: "allow" } } },
          // تفويض صلاحية فعّال يمنح رؤية القضية — يطابق hasActiveDelegation في canAccessCase.
          { delegations: { some: { grantedToId: user.id, revokedAt: null, expiresAt: { gt: now } } } },
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

// ============================================================================
// تفويض الصلاحيات على مستوى القضية
// ============================================================================

/**
 * ترتيب سلسلة التفويض: system_admin → supervisor → lawyer/researcher.
 * لا يُفوَّض إلا لمن هو أدنى في السلسلة (منع التفويض الأفقي أو الصاعد).
 */
export const DELEGATION_CHAIN_RANK: Record<UserRole, number> = {
  system_admin: 3,
  supervisor: 2,
  lawyer: 1,
  researcher: 1,
  secretary: 0,
  accountant: 0,
};

/** هل يجوز لصاحب دور granterRole أن يفوّض لصاحب دور recipientRole (أدنى منه في السلسلة)؟ */
export function canDelegateTo(granterRole: UserRole, recipientRole: UserRole): boolean {
  return DELEGATION_CHAIN_RANK[granterRole] > DELEGATION_CHAIN_RANK[recipientRole];
}

/** نوع مصغّر لتفويض عند فحص الصلاحية (يشمل دور المُفوِّض لفحص أهليته الديناميكي). */
type DelegationForCheck = {
  grantedToId: string;
  grantedById: string;
  grantedBy: { role: UserRole };
  permission: DelegatedPermission;
  revokedAt: Date | null;
  expiresAt: Date;
};

type CasePermissionInput = {
  responsibleLawyerId: string;
  team: { userId: string }[];
  accessOverrides: { userId: string; accessType: "allow" | "deny" }[];
  delegations: DelegationForCheck[];
};

/**
 * هل يملك المستخدم الصلاحية **بحكم وضعه المباشر** (دوره + عضويته المباشرة في القضية)، دون تفويض؟
 * هذه هي القاعدة التي تمنع تصعيد الامتيازات: لا أحد يفوّض ما لا يملكه أصلًا هنا.
 */
export function hasBaseCasePermission(
  user: SessionUser,
  caseData: CaseAccessInput,
  permission: DelegatedPermission
): boolean {
  if (!hasDirectCaseAccess(user, caseData)) return false;
  switch (permission) {
    case "edit_case":
      return user.role !== "accountant";
    case "manage_team":
      return user.role === "system_admin" || user.role === "supervisor";
    case "assign_tasks":
      // كل الأدوار العاملة على القضايا تنشئ مهامًا (مع قيود المُسند إليه في canAssignTaskTo).
      return (
        user.role === "system_admin" ||
        user.role === "supervisor" ||
        user.role === "lawyer" ||
        user.role === "researcher"
      );
    case "write_memo":
      // الباحث/المسؤول + المحامي الرئيسي (المسؤول) لقضيته؛ الباقون عبر تفويض write_memo.
      return (
        user.role === "system_admin" ||
        user.role === "researcher" ||
        caseData.responsibleLawyerId === user.id
      );
    case "manage_timeline":
      // مُنشئ القضية + المحامي الرئيسي + مسؤول النظام (الباقون: عرض فقط).
      return (
        user.role === "system_admin" ||
        caseData.responsibleLawyerId === user.id ||
        (caseData.createdById != null && caseData.createdById === user.id)
      );
    default:
      return false;
  }
}

/**
 * هل يملك المستخدم الصلاحية عبر تفويض فعّال؟ التفويض صالح فقط إذا:
 *  - لا يوجد DENY صريح على المستخدم (يتفوّق دائمًا).
 *  - غير ملغى (revokedAt == null) وغير منتهٍ (expiresAt > now).
 *  - **المُفوِّض ما زال يملك الصلاحية فعليًا** (بحكم وضعه المباشر) وقت الفحص — تحقق ديناميكي،
 *    فإن فقد المُفوِّض دوره/عضويته سقط التفويض تلقائيًا (ويمنع إعادة تفويض صلاحية مُفوَّضة).
 */
export function hasDelegatedPermission(
  user: SessionUser,
  caseData: CasePermissionInput,
  permission: DelegatedPermission
): boolean {
  if (isDenied(user.id, caseData.accessOverrides)) return false; // DENY يتفوّق على التفويض
  const now = Date.now();
  return caseData.delegations.some(
    (d) =>
      d.grantedToId === user.id &&
      d.permission === permission &&
      d.revokedAt == null &&
      new Date(d.expiresAt).getTime() > now &&
      hasBaseCasePermission({ id: d.grantedById, role: d.grantedBy.role }, caseData, permission)
  );
}

/** الصلاحية الفعّالة = مباشرة أو مُفوَّضة صالحة. */
export function canPerformOnCase(
  user: SessionUser,
  caseData: CasePermissionInput,
  permission: DelegatedPermission
): boolean {
  return hasBaseCasePermission(user, caseData, permission) || hasDelegatedPermission(user, caseData, permission);
}

/**
 * مثل canPerformOnCase لكن يوضّح إن كان القبول عبر تفويض — لتسجيله في التدقيق.
 * DENY الصريح يُرفض داخل الدالتين الأساسيتين (يتفوّق على التفويض).
 */
export function resolveCasePermission(
  user: SessionUser,
  caseData: CasePermissionInput,
  permission: DelegatedPermission
): { allowed: boolean; viaDelegation: boolean } {
  if (hasBaseCasePermission(user, caseData, permission)) return { allowed: true, viaDelegation: false };
  const delegated = hasDelegatedPermission(user, caseData, permission);
  return { allowed: delegated, viaDelegation: delegated };
}

/** تضمين Prisma الموحّد لتحميل القضية بما يلزم فحص الصلاحيات الفعّالة (canPerformOnCase). */
export const casePermissionInclude = {
  team: { select: { userId: true } },
  accessOverrides: { select: { userId: true, accessType: true } },
  delegations: {
    select: {
      grantedToId: true,
      grantedById: true,
      permission: true,
      revokedAt: true,
      expiresAt: true,
      grantedBy: { select: { role: true } },
    },
  },
} as const;
