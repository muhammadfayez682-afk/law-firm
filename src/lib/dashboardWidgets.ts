// سجلّ ودجتات لوحة التحكم — قائمة ثابتة قابلة للتوسّع. الإظهار/الإخفاء فقط (لا ترتيب مخصّص بعد).
// ملف نقيّ (بلا خادم) يُستورد في الواجهة والـ API لتوحيد المعرّفات والتحقق منها.

export type DashboardWidgetId =
  | "kpis"
  | "my_tasks"
  | "my_sessions"
  | "judicial_calendar"
  | "role_overview";

export type DashboardWidgetMeta = {
  id: DashboardWidgetId;
  label: string;
  description: string;
};

// الترتيب هنا = ترتيب الظهور في مودال التخصيص (ترتيب العرض الفعلي يُحدَّد في صفحة اللوحة).
export const DASHBOARD_WIDGETS: readonly DashboardWidgetMeta[] = [
  { id: "kpis", label: "الأرقام السريعة", description: "شريط مضغوط بمؤشرات دورك الرئيسية" },
  { id: "my_tasks", label: "مهامي", description: "المهام المسندة إليك مع حالتها وتاريخ استحقاقها" },
  { id: "my_sessions", label: "جلساتي القادمة", description: "جلسات ومواعيد قضاياك القادمة مرتّبة زمنيًا" },
  { id: "judicial_calendar", label: "التقويم العدلي", description: "أيام العمل والعطل الرسمية وجلسات الأسبوع" },
  { id: "role_overview", label: "تفاصيل لوحتي", description: "التنبيهات والقوائم الخاصة بدورك (قضاياك وخدماتك ومواعيدك)" },
] as const;

// الافتراضي عند أول دخول: كل الودجتات ظاهرة.
export const DEFAULT_VISIBLE_WIDGETS: DashboardWidgetId[] = [
  "kpis",
  "my_tasks",
  "my_sessions",
  "judicial_calendar",
  "role_overview",
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
