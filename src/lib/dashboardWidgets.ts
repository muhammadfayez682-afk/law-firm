// سجلّ ودجتات لوحة التحكم — قائمة ثابتة قابلة للتوسّع. الإظهار/الإخفاء فقط (لا ترتيب مخصّص بعد).
// ملف نقيّ (بلا خادم) يُستورد في الواجهة والـ API لتوحيد المعرّفات والتحقق منها.

export type DashboardWidgetId =
  | "my_tasks"
  | "my_sessions"
  | "role_overview"
  | "judicial_calendar";

export type DashboardWidgetMeta = {
  id: DashboardWidgetId;
  label: string;
  description: string;
};

// الترتيب هنا = ترتيب العرض الثابت في اللوحة (الإظهار/الإخفاء لا يغيّره).
export const DASHBOARD_WIDGETS: readonly DashboardWidgetMeta[] = [
  { id: "my_tasks", label: "مهامي", description: "المهام المسندة إليك مع حالتها وتاريخ استحقاقها" },
  { id: "my_sessions", label: "جلساتي القادمة", description: "جلسات ومواعيد قضاياك القادمة مرتّبة زمنيًا" },
  { id: "role_overview", label: "ملخص لوحتي", description: "المؤشرات والقوائم الخاصة بدورك (KPIs وقضاياك وخدماتك)" },
  { id: "judicial_calendar", label: "التقويم العدلي", description: "أيام العمل والعطل الرسمية وجلسات الأسبوع" },
] as const;

// الافتراضي عند أول دخول: مجموعة منطقية ظاهرة (كل الودجتات — العمل الشخصي + المؤشرات + التقويم).
export const DEFAULT_VISIBLE_WIDGETS: DashboardWidgetId[] = [
  "my_tasks",
  "my_sessions",
  "role_overview",
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
