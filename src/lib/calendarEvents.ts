// أنواع أحداث التقويم العدلي وبياناتها الوصفية (لون/أيقونة/تسمية) — ملف نقيّ يُشترك بين الـ API والواجهة.

export type CalendarEventType =
  | "session" // جلسة محكمة (مرافعة/استماع/نطق حكم/تحكيم)
  | "settlement_meeting" // جلسة تسوية ودية (قوى/تراضي)
  | "settlement_deadline" // مهلة تسوية ودية
  | "appeal_deadline" // مهلة استئناف (آخر يوم للطعن)
  | "follow_up" // تاريخ متابعة القضية
  | "task_deadline"; // استحقاق مهمة مرتبطة بقضية

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  caseId: string | null;
  caseNumber: string | null;
  start: string; // ISO
  end: string | null; // ISO أو null لأحداث اللحظة/المهل
  location: string | null;
  url: string; // وجهة النقر
};

export type CalendarEventMeta = {
  label: string;
  icon: string;
  dot: string; // لون النقطة/الشارة الصلب
  chip: string; // أصناف الخلفية/النص/الحد للشريحة
};

// ألوان دلالية متسقة مع لوحة النظام (gold/taradhi + أحمر للمهل + نيلي للمهام).
export const CALENDAR_EVENT_META: Record<CalendarEventType, CalendarEventMeta> = {
  session: {
    label: "جلسة محكمة",
    icon: "⚖️",
    dot: "bg-gold",
    chip: "bg-gold/10 text-gold border-gold/40",
  },
  settlement_meeting: {
    label: "جلسة تسوية ودية",
    icon: "🤝",
    dot: "bg-taradhi",
    chip: "bg-taradhi/10 text-taradhi border-taradhi/40",
  },
  settlement_deadline: {
    label: "مهلة تسوية",
    icon: "⏳",
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-700 border-red-300",
  },
  appeal_deadline: {
    label: "مهلة استئناف",
    icon: "🛑",
    dot: "bg-rose-600",
    chip: "bg-rose-100 text-rose-800 border-rose-400",
  },
  follow_up: {
    label: "متابعة",
    icon: "🔔",
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-300",
  },
  task_deadline: {
    label: "استحقاق مهمة",
    icon: "📌",
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-300",
  },
};

export const CALENDAR_EVENT_ORDER: CalendarEventType[] = [
  "session",
  "settlement_meeting",
  "settlement_deadline",
  "appeal_deadline",
  "follow_up",
  "task_deadline",
];
