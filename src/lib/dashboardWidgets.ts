// سجلّ ودجتات لوحة التحكم — قائمة ثابتة قابلة للتوسّع. الإظهار/الإخفاء فقط (لا ترتيب مخصّص بعد).
// ملف نقيّ (بلا خادم) يُستورد في الواجهة والـ API لتوحيد المعرّفات والتحقق منها.

export type DashboardWidgetId =
  | "kpis"
  | "critical_dates"
  | "active_cases"
  | "my_sessions"
  | "my_memos"
  | "my_tasks"
  | "judicial_calendar"
  | "role_overview";

export type DashboardWidgetMeta = {
  id: DashboardWidgetId;
  label: string;
  description: string;
};

// الترتيب هنا = ترتيب الظهور في مودال التخصيص (ترتيب العرض الفعلي يُحدَّد في صفحة اللوحة).
export const DASHBOARD_WIDGETS: readonly DashboardWidgetMeta[] = [
  { id: "kpis", label: "شريط المؤشرات", description: "المستويات الثلاثة: يحتاج انتباهك · نظرة عامة · مؤشرات أخرى" },
  { id: "critical_dates", label: "تواريخ حرجة", description: "مهل الاستئناف وتواريخ المتابعة القريبة على قضاياك" },
  { id: "active_cases", label: "القضايا النشطة", description: "قضاياك النشطة مع العميل/المحكمة ووسم المرحلة" },
  { id: "my_sessions", label: "الجلسات القادمة", description: "جلسات ومواعيد قضاياك القادمة مرتّبة زمنيًا" },
  { id: "my_memos", label: "المذكرات المعلّقة", description: "المذكرات غير المعتمدة (مسودة/قيد المراجعة/تعديلات) على قضاياك" },
  { id: "my_tasks", label: "مهامي", description: "المهام المسندة إليك مع حالتها وتاريخ استحقاقها" },
  { id: "judicial_calendar", label: "التقويم العدلي", description: "أيام العمل والعطل الرسمية وجلسات الأسبوع" },
  { id: "role_overview", label: "تفاصيل لوحتي", description: "تنبيهات وقوائم إضافية خاصة بدورك (اختياري)" },
] as const;

// الافتراضي عند أول دخول: شريط المؤشرات + التواريخ الحرجة + الودجتات الأربعة الأساسية + التقويم.
// (role_overview اختياري — يُفعّله المستخدم من «تخصيص اللوحة» عند الحاجة لتفاصيل دوره الإضافية.)
export const DEFAULT_VISIBLE_WIDGETS: DashboardWidgetId[] = [
  "kpis",
  "critical_dates",
  "active_cases",
  "my_sessions",
  "my_memos",
  "my_tasks",
  "judicial_calendar",
];

const VALID_IDS = new Set<string>(DASHBOARD_WIDGETS.map((w) => w.id));

export function isDashboardWidgetId(v: unknown): v is DashboardWidgetId {
  return typeof v === "string" && VALID_IDS.has(v);
}

/** يُبقي المعرّفات الصالحة فقط بلا تكرار، بترتيب السجلّ الثابت. */
export function sanitizeWidgets(ids: unknown): DashboardWidgetId[] {
  if (!Array.isArray(ids)) return [];
  const chosen = new Set(ids.filter(isDashboardWidgetId));
  return DASHBOARD_WIDGETS.map((w) => w.id).filter((id) => chosen.has(id));
}
