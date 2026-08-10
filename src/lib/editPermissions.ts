import type { CaseStatus, ChangeReason, UserRole } from "@prisma/client";
import type { TrackedEntityType } from "@/lib/entityChangeTracker";

/** أسباب التعديل بالعربية (لمودال التعديل وسجل التعديلات). */
export const CHANGE_REASON_LABELS_AR: Record<ChangeReason, string> = {
  data_entry_error: "خطأ إدخال",
  official_update: "تحديث رسمي (المحكمة/ناجز)",
  client_information_change: "تغيير من العميل",
  legal_correction: "تصحيح قانوني",
  system_migration: "نقل بيانات",
  other: "أخرى",
};

/**
 * صلاحيات تعديل الحقول لكل كيان:
 *  - allowedRoles: الأدوار المسموح لها بتعديل الحقل.
 *  - lockAfter: يُقفل الحقل عند وصول الكيان لهذه الحالة أو ما بعدها
 *    ("any" = لا يُعدَّل أبدًا، null = متاح دائمًا).
 *
 * **لإضافة حقل جديد للنظام**: أضِف مدخلًا هنا تحت الكيان المناسب،
 * وأضِف تسميته العربية في `EDIT_FIELD_LABELS`، وأدرجه في واجهة التعديل.
 */

type FieldRule = { allowedRoles: UserRole[]; lockAfter: CaseStatus | "any" | "accepted" | null };

export const editPermissions: Record<string, Record<string, FieldRule>> = {
  case: {
    title: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    courtCaseNumber: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    courtName: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: "closed" },
    department: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: "closed" },
    judge: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: "closed" },
    caseType: { allowedRoles: ["system_admin"], lockAfter: "open" },
    internalNumber: { allowedRoles: [], lockAfter: "any" },
    claimValue: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    priority: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    notes: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    clientPartyRole: { allowedRoles: ["system_admin", "supervisor"], lockAfter: "open" },
  },
  client: {
    fullName: { allowedRoles: ["system_admin", "supervisor", "secretary"], lockAfter: null },
    nationalIdOrCr: { allowedRoles: ["system_admin"], lockAfter: null },
    phone: { allowedRoles: ["system_admin", "supervisor", "secretary", "lawyer"], lockAfter: null },
    email: { allowedRoles: ["system_admin", "supervisor", "secretary", "lawyer"], lockAfter: null },
    representativeName: { allowedRoles: ["system_admin", "supervisor", "secretary"], lockAfter: null },
  },
  agency: {
    agencyNumber: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    agencyType: { allowedRoles: ["system_admin", "supervisor"], lockAfter: null },
    scopeText: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    issueDate: { allowedRoles: ["system_admin"], lockAfter: null },
    expiryDate: { allowedRoles: ["system_admin", "supervisor"], lockAfter: null },
  },
  party: {
    name: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: "open" },
    role: { allowedRoles: ["system_admin"], lockAfter: "open" },
    identityNumber: { allowedRoles: ["system_admin", "supervisor"], lockAfter: null },
    opposingCounsel: { allowedRoles: ["system_admin", "supervisor", "lawyer"], lockAfter: null },
    isOurClient: { allowedRoles: [], lockAfter: "any" },
  },
  intake: {
    // كل حقول الطلب تتبع نفس القاعدة، وتُقفل بعد التفعيل (accepted).
    all: { allowedRoles: ["system_admin", "supervisor", "secretary"], lockAfter: "accepted" },
  },
};

/** التسميات العربية للحقول القابلة للتعديل (تُستخدم في المودال وسجل التعديلات). */
export const EDIT_FIELD_LABELS: Record<string, string> = {
  title: "عنوان القضية",
  courtCaseNumber: "رقم القضية بالمحكمة",
  courtName: "المحكمة",
  department: "الدائرة",
  judge: "فضيلة القاضي",
  caseType: "نوع القضية",
  internalNumber: "الرقم الداخلي",
  claimValue: "قيمة المطالبة",
  priority: "الأولوية",
  notes: "الملاحظات",
  clientPartyRole: "صفة موكّلنا",
  fullName: "الاسم الكامل",
  nationalIdOrCr: "رقم الهوية/السجل",
  phone: "الجوال",
  email: "البريد الإلكتروني",
  representativeName: "اسم الممثل",
  agencyNumber: "رقم الوكالة",
  agencyType: "نوع الوكالة",
  scopeText: "نطاق الوكالة",
  issueDate: "تاريخ الإصدار",
  expiryDate: "تاريخ الانتهاء",
  name: "الاسم",
  role: "الصفة",
  identityNumber: "رقم الهوية",
  opposingCounsel: "محامي الطرف المقابل",
};

// ترتيب حالات القضية لتحديد "القفل عند الوصول لحالة أو ما بعدها".
const CASE_STATUS_ORDER: CaseStatus[] = [
  "intake",
  "pending_agency",
  "amicable_settlement",
  "settled_amicably",
  "open",
  "in_progress",
  "on_hold",
  "ruled_first_instance",
  "appealed",
  "pending_closure",
  "closed",
  "archived",
];

function isStatusLocked(lockAfter: FieldRule["lockAfter"], entityStatus: unknown, entityType: string): boolean {
  if (lockAfter === null) return false;
  if (lockAfter === "any") return true;
  if (typeof entityStatus !== "string") return false;

  if (entityType === "intake") {
    // الطلب يُقفل بعد التفعيل (accepted).
    return entityStatus === "accepted";
  }
  // قضية/طرف/وكالة تعتمد ترتيب حالة القضية.
  const thresholdIdx = CASE_STATUS_ORDER.indexOf(lockAfter as CaseStatus);
  const currentIdx = CASE_STATUS_ORDER.indexOf(entityStatus as CaseStatus);
  if (thresholdIdx === -1 || currentIdx === -1) return false;
  return currentIdx >= thresholdIdx;
}

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: "مسؤول النظام",
  supervisor: "مشرف",
  lawyer: "محامٍ",
  researcher: "باحث",
  secretary: "سكرتير",
  accountant: "محاسب",
};

export type EditCheck = { allowed: boolean; reason?: string };

/**
 * هل يستطيع المستخدم تعديل هذا الحقل الآن؟
 * `entity` يجب أن يحمل `status` (للقضية/الطلب؛ وللطرف نمرّر حالة القضية).
 */
export function canEditField(
  entityType: TrackedEntityType,
  fieldName: string,
  userRole: UserRole,
  entity: { status?: unknown }
): EditCheck {
  const entityRules = editPermissions[entityType];
  if (!entityRules) return { allowed: false, reason: "كيان غير معروف" };

  // الطلب: كل الحقول تتبع القاعدة الموحّدة "all".
  const config = entityType === "intake" ? entityRules.all : entityRules[fieldName];
  if (!config) return { allowed: false, reason: "حقل غير معروف" };

  if (config.lockAfter === "any") {
    return { allowed: false, reason: "هذا الحقل غير قابل للتعديل" };
  }
  if (!config.allowedRoles.includes(userRole)) {
    return {
      allowed: false,
      reason: `يتطلب دور: ${config.allowedRoles.map((r) => ROLE_LABELS[r]).join(" أو ") || "—"}`,
    };
  }
  if (isStatusLocked(config.lockAfter, entity.status, entityType)) {
    return { allowed: false, reason: "الحقل مقفل في حالة القضية الحالية" };
  }
  return { allowed: true };
}

/** أسماء الحقول المُعرَّفة لكيان (لبناء واجهة التعديل). */
export function getEntityFieldNames(entityType: TrackedEntityType): string[] {
  const rules = editPermissions[entityType];
  if (!rules) return [];
  return Object.keys(rules).filter((k) => k !== "all");
}
