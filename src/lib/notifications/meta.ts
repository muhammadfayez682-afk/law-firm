import type { NotificationPriority, NotificationType } from "@prisma/client";

export type NotificationCategoryKey =
  | "intake"
  | "memo"
  | "case"
  | "session"
  | "agency"
  | "settlement"
  | "task"
  | "invoice"
  | "general";

export const NOTIFICATION_CATEGORY_LABELS_AR: Record<NotificationCategoryKey, string> = {
  intake: "الاستلام",
  memo: "المذكرات",
  case: "القضايا",
  session: "الجلسات",
  agency: "الوكالات",
  settlement: "التسوية",
  task: "المهام",
  invoice: "الفواتير",
  general: "عام",
};

export type NotificationMeta = {
  label: string;
  description: string;
  icon: string; // إيموجي (يعمل في RTL بلا أصول خارجية)
  category: NotificationCategoryKey;
  defaultPriority: NotificationPriority;
};

/** بيانات وصفية لكل نوع إشعار: التسمية العربية، الوصف، الأيقونة، الفئة، الأولوية الافتراضية. */
export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  // الاستلام
  intake_new: { label: "طلب استلام جديد", description: "وصل طلب استلام قضية جديد", icon: "📥", category: "intake", defaultPriority: "normal" },
  intake_conflict_detected: { label: "تعارض مصالح مكتشف", description: "فحص التعارض اكتشف تعارضًا مؤكدًا", icon: "⚠️", category: "intake", defaultPriority: "urgent" },
  intake_pending_assessment: { label: "طلب بانتظار التقييم", description: "طلب استلام ينتظر دراسة التقييم", icon: "🔎", category: "intake", defaultPriority: "normal" },
  intake_assessment_delegated: { label: "تفويض تقييم", description: "فُوِّض إليك تقييم طلب استلام", icon: "📨", category: "intake", defaultPriority: "high" },
  intake_pending_decision: { label: "طلب بانتظار القرار", description: "طلب استلام اكتمل تقييمه وينتظر القرار", icon: "⚖️", category: "intake", defaultPriority: "normal" },
  intake_accepted: { label: "قبول طلب استلام", description: "قُبل طلب الاستلام", icon: "✅", category: "intake", defaultPriority: "normal" },
  intake_rejected: { label: "رفض طلب استلام", description: "رُفض طلب الاستلام", icon: "❌", category: "intake", defaultPriority: "normal" },

  // المذكرات
  memo_assigned: { label: "إسناد مذكرة", description: "أُسندت إليك كتابة مذكرة", icon: "📝", category: "memo", defaultPriority: "normal" },
  memo_pending_review: { label: "مذكرة بانتظار المراجعة", description: "مذكرة أُرسلت لمراجعتك", icon: "📋", category: "memo", defaultPriority: "high" },
  memo_changes_requested: { label: "طلب تعديلات على مذكرة", description: "طُلبت تعديلات على مذكرتك", icon: "✏️", category: "memo", defaultPriority: "high" },
  memo_approved: { label: "اعتماد مذكرة", description: "اعتُمدت مذكرتك", icon: "✅", category: "memo", defaultPriority: "normal" },
  memo_submitted_to_court: { label: "تقديم مذكرة للمحكمة", description: "قُدّمت المذكرة للمحكمة", icon: "🏛️", category: "memo", defaultPriority: "normal" },

  // القضايا
  case_assigned: { label: "إسناد قضية", description: "أُسندت إليك قضية", icon: "📁", category: "case", defaultPriority: "normal" },
  case_closure_requested: { label: "طلب إغلاق قضية", description: "طُلب إغلاق قضية وينتظر الاعتماد", icon: "🔒", category: "case", defaultPriority: "high" },
  case_closure_approved: { label: "اعتماد إغلاق قضية", description: "اعتُمد إغلاق القضية", icon: "✅", category: "case", defaultPriority: "normal" },
  case_closure_rejected: { label: "رفض إغلاق قضية", description: "رُفض طلب إغلاق القضية", icon: "↩️", category: "case", defaultPriority: "high" },
  case_reopened: { label: "إعادة فتح قضية", description: "أُعيد فتح قضية", icon: "🔓", category: "case", defaultPriority: "normal" },
  case_number_added: { label: "إضافة رقم محكمة", description: "أُضيف رقم المحكمة الرسمي للقضية", icon: "🔢", category: "case", defaultPriority: "normal" },
  case_archived: { label: "أرشفة قضية", description: "أُرشفت قضية", icon: "🗄️", category: "case", defaultPriority: "normal" },
  case_restored: { label: "استرجاع قضية", description: "أُعيدت قضية من الأرشيف", icon: "♻️", category: "case", defaultPriority: "normal" },
  case_deleted: { label: "حذف نهائي لقضية", description: "حُذفت قضية نهائيًا", icon: "🗑️", category: "case", defaultPriority: "urgent" },

  // الجلسات
  session_scheduled: { label: "جدولة جلسة", description: "جُدولت جلسة جديدة", icon: "📅", category: "session", defaultPriority: "normal" },
  session_reminder_day: { label: "تذكير جلسة (غدًا)", description: "تذكير بجلسة خلال 24 ساعة", icon: "⏰", category: "session", defaultPriority: "high" },
  session_reminder_hour: { label: "تذكير جلسة (ساعة)", description: "تذكير بجلسة خلال ساعة", icon: "⏰", category: "session", defaultPriority: "urgent" },
  session_cancelled: { label: "إلغاء جلسة", description: "أُلغيت جلسة", icon: "🚫", category: "session", defaultPriority: "high" },
  session_postponed: { label: "تأجيل جلسة", description: "أُجّلت جلسة", icon: "📆", category: "session", defaultPriority: "normal" },
  session_prep_reminder: { label: "تحضير الجلسة لم يكتمل", description: "مهام تحضير ناقصة قبل الجلسة بـ3 أيام", icon: "📋", category: "session", defaultPriority: "high" },
  session_prep_urgent: { label: "تحضير الجلسة عاجل", description: "مهام تحضير ناقصة قبل الجلسة بأقل من 24 ساعة", icon: "⏰", category: "session", defaultPriority: "urgent" },
  session_prep_critical: { label: "عنصر تحضير حرج غير جاهز", description: "الوكالة أو المذكرات غير جاهزة قبل الجلسة", icon: "🚨", category: "session", defaultPriority: "urgent" },

  // الوكالات
  agency_expiring_soon: { label: "وكالة تقترب من الانتهاء", description: "وكالة تنتهي خلال 30 يومًا", icon: "📜", category: "agency", defaultPriority: "normal" },
  agency_expiring_urgent: { label: "وكالة توشك على الانتهاء", description: "وكالة تنتهي خلال 7 أيام", icon: "📜", category: "agency", defaultPriority: "high" },
  agency_expired: { label: "انتهاء وكالة", description: "انتهت صلاحية وكالة", icon: "⛔", category: "agency", defaultPriority: "urgent" },
  agency_pending_reminder: { label: "الوكالة لم تصدر بعد", description: "مرّت 3 أيام على التفعيل بلا وكالة", icon: "⏳", category: "agency", defaultPriority: "normal" },
  agency_pending_urgent: { label: "متابعة الوكالة مطلوبة", description: "مرّ أسبوع على التفعيل بلا وكالة", icon: "⏳", category: "agency", defaultPriority: "high" },
  agency_delayed: { label: "قضية متأخرة الوكالة", description: "مرّ أسبوعان على التفعيل بلا وكالة", icon: "🚩", category: "agency", defaultPriority: "urgent" },
  agency_issued: { label: "صدور الوكالة", description: "صدرت الوكالة والقضية صارت نشطة كاملة", icon: "📜", category: "agency", defaultPriority: "normal" },

  // التسوية
  settlement_deadline_soon: { label: "مهلة تسوية تقترب", description: "مهلة تسوية تنتهي خلال 7 أيام", icon: "🤝", category: "settlement", defaultPriority: "normal" },
  settlement_deadline_urgent: { label: "مهلة تسوية عاجلة", description: "مهلة تسوية تنتهي خلال يومين", icon: "🤝", category: "settlement", defaultPriority: "urgent" },
  settlement_settled: { label: "نجاح تسوية", description: "تمت التسوية وديًا", icon: "✅", category: "settlement", defaultPriority: "normal" },
  settlement_failed: { label: "تعذّر تسوية", description: "تعذّرت التسوية الودية", icon: "❌", category: "settlement", defaultPriority: "normal" },

  // المهام
  task_assigned: { label: "إسناد مهمة", description: "أُسندت إليك مهمة", icon: "📌", category: "task", defaultPriority: "normal" },
  task_due_soon: { label: "مهمة تقترب من الاستحقاق", description: "مهمة تستحق قريبًا", icon: "⏳", category: "task", defaultPriority: "high" },
  task_overdue: { label: "مهمة متأخرة", description: "مهمة تجاوزت موعد استحقاقها", icon: "🔴", category: "task", defaultPriority: "urgent" },
  task_completed: { label: "إنجاز مهمة", description: "أُنجزت مهمة أسندتها", icon: "✅", category: "task", defaultPriority: "normal" },
  task_comment_added: { label: "ملاحظة على مهمة", description: "أُضيفت ملاحظة على مهمة", icon: "💬", category: "task", defaultPriority: "normal" },

  // الفواتير
  invoice_overdue: { label: "فاتورة متأخرة", description: "فاتورة تجاوزت موعد استحقاقها", icon: "💰", category: "invoice", defaultPriority: "high" },

  // عام
  mention: { label: "إشارة", description: "أشار إليك أحدهم", icon: "@", category: "general", defaultPriority: "normal" },
  system_announcement: { label: "إعلان النظام", description: "إعلان عام من النظام", icon: "📢", category: "general", defaultPriority: "normal" },
};

/** كل أنواع الإشعارات (مشتقّة من مفاتيح البيانات الوصفية). */
export const ALL_NOTIFICATION_TYPES = Object.keys(NOTIFICATION_META) as NotificationType[];

/** أنواع مصنّفة حسب الفئة (لصفحة التفضيلات). */
export function getTypesByCategory(): Record<NotificationCategoryKey, NotificationType[]> {
  const grouped = {} as Record<NotificationCategoryKey, NotificationType[]>;
  for (const type of ALL_NOTIFICATION_TYPES) {
    const cat = NOTIFICATION_META[type].category;
    (grouped[cat] ??= []).push(type);
  }
  return grouped;
}
