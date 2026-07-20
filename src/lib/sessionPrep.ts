import type { PrepTaskType } from "@prisma/client";

export const PREP_TASK_LABELS_AR: Record<PrepTaskType, string> = {
  team_meeting: "اجتماع تحضيري للفريق",
  client_contact: "التواصل مع العميل",
  najiz_review: "مراجعة ملف القضية في ناجز",
  agency_verification: "التحقق من الوكالة",
  memos_review: "مراجعة المذكرات المعتمدة",
  documents_review: "مراجعة المستندات والأدلة",
  external_review: "مراجعة خارجية",
  strategy_alignment: "مواءمة الاستراتيجية",
  other: "أخرى",
};

/**
 * العناصر الحرجة: عدم إنجازها قبل الجلسة يمنع الترافع فعليًا
 * (وكالة غير موثّقة أو مذكرة غير معتمدة) — تُبرز بتحذير أحمر.
 */
export const CRITICAL_PREP_TYPES: PrepTaskType[] = ["agency_verification", "memos_review"];

export function isCriticalPrepTask(type: PrepTaskType): boolean {
  return CRITICAL_PREP_TYPES.includes(type);
}

/** قائمة مهام التحضير الافتراضية (6) التي تُولَّد تلقائيًا لكل جلسة. */
export const DEFAULT_PREP_TASKS: {
  taskType: PrepTaskType;
  title: string;
  description: string;
  isRequired: boolean;
}[] = [
  {
    taskType: "team_meeting",
    title: "طلب اجتماع تحضيري",
    description: "تحديد موعد اجتماع الفريق لمراجعة خطة الجلسة وتوزيع الأدوار.",
    isRequired: true,
  },
  {
    taskType: "client_contact",
    title: "التواصل مع العميل",
    description: "إبلاغ الموكل بموعد الجلسة والتأكد من حضوره/تفويضه وتحديث بياناته.",
    isRequired: true,
  },
  {
    taskType: "najiz_review",
    title: "مراجعة ملف القضية في ناجز",
    description: "التحقق من آخر تحديثات الملف والقرارات والمواعيد في منصة ناجز.",
    isRequired: true,
  },
  {
    taskType: "agency_verification",
    title: "التحقق من الوكالة",
    description: "التأكد من صدور الوكالة وسريان مفعولها وشمولها نطاق الترافع. (حرج)",
    isRequired: true,
  },
  {
    taskType: "memos_review",
    title: "مراجعة المذكرات المعتمدة",
    description: "التأكد من اعتماد المذكرات المطلوبة وجاهزيتها للتقديم. (حرج)",
    isRequired: true,
  },
  {
    taskType: "documents_review",
    title: "مراجعة المستندات والأدلة",
    description: "التحقق من اكتمال المستندات والأدلة وترتيبها قبل الجلسة.",
    isRequired: true,
  },
];

/** نسبة إنجاز قائمة التحضير. */
export function prepProgress(tasks: { isCompleted: boolean }[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.isCompleted).length / tasks.length) * 100);
}
