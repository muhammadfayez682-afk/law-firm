// تفويض الصلاحيات على مستوى القضية — التسميات والثوابت (ملف نقيّ).
import type { DelegatedPermission } from "@prisma/client";

export const DELEGATED_PERMISSION_LABELS_AR: Record<DelegatedPermission, string> = {
  edit_case: "تعديل بيانات القضية",
  manage_team: "إدارة فريق القضية",
  assign_tasks: "إسناد المهام",
  write_memo: "كتابة المذكرات",
  manage_timeline: "إدارة مسار القضية",
};

export const ALL_DELEGATED_PERMISSIONS: DelegatedPermission[] = [
  "edit_case",
  "manage_team",
  "assign_tasks",
  "write_memo",
  "manage_timeline",
];

/** مهلة التفويض الافتراضية إن لم يُحدَّد تاريخ انتهاء. */
export const DELEGATION_DEFAULT_EXPIRY_DAYS = 30;
