"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CALENDAR_EVENT_META,
  CALENDAR_EVENT_ORDER,
  type CalendarEvent,
} from "@/lib/calendarEvents";
import { toHijri, getHijriMonthLabel, formatDualDate, formatTime } from "@/lib/dateUtils";
import { dayStatus } from "@/lib/judicialCalendar";

type ViewMode = "month" | "week" | "agenda";

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MS_DAY = 24 * 60 * 60 * 1000;
const URGENT_MS = 48 * 60 * 60 * 1000;

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function gregMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

/** يحسب نطاق [from,to] للعرض الحالي — الشهري يملأ 6 أسابيع. */
function computeRange(view: ViewMode, anchor: Date): { from: Date; to: Date; gridStart: Date; days: number } {
  if (view === "week") {
    const weekStart = addDays(startOfDay(anchor), -anchor.getDay());
    return { from: weekStart, to: new Date(addDays(weekStart, 6).getTime() + MS_DAY - 1), gridStart: weekStart, days: 7 };
  }
  // month + agenda يستخدمان نطاق الشهر (شبكة 42 يومًا).
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(startOfDay(monthStart), -monthStart.getDay());
  return { from: gridStart, to: new Date(addDays(gridStart, 41).getTime() + MS_DAY - 1), gridStart, days: 42 };
}

export function CalendarView() {
  // بوابة التحميل: كل المحتوى معتمد على التاريخ الحالي (غير حتمي بين الخادم والعميل).
  // نؤجّل العرض حتى ما بعد التركيب لتفادي عدم تطابق hydration (وإلا يفشل التفاعل ولا يعمل الجلب).
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const now = useMemo(() => new Date(), [mounted]);
  const { from, to, gridStart, days } = useMemo(() => computeRange(view, anchor), [view, anchor]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, mounted]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = localKey(new Date(e.start));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  function navigate(dir: -1 | 0 | 1) {
    if (dir === 0) return setAnchor(new Date());
    if (view === "week") return setAnchor((a) => addDays(a, dir * 7));
    return setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  // هيكل تحميل حتمي قبل التركيب — يطابق ما يُصيّره الخادم فيمنع عدم تطابق hydration.
  if (!mounted) {
    return (
      <div dir="rtl" className="space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-black/5" />
        <div className="h-[520px] animate-pulse rounded-xl bg-black/5" />
      </div>
    );
  }

  const title =
    view === "week"
      ? `${gregMonthYear(gridStart)} — ${getHijriMonthLabel(gridStart)}`
      : `${gregMonthYear(anchor)} — ${getHijriMonthLabel(anchor)}`;

  return (
    <div dir="rtl" className="space-y-4">
      {/* شريط التحكم */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(1)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-navy hover:bg-black/5" aria-label="التالي">
            ‹ التالي
          </button>
          <button onClick={() => navigate(0)} className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-light">
            اليوم
          </button>
          <button onClick={() => navigate(-1)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-navy hover:bg-black/5" aria-label="السابق">
            السابق ›
          </button>
          <h2 className="mr-2 font-amiri text-lg font-bold text-navy">{title}</h2>
        </div>

        <div className="flex rounded-lg border border-black/10 p-0.5 text-sm">
          {([["month", "شهري"], ["week", "أسبوعي"], ["agenda", "قائمة"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                view === v ? "bg-gold text-white" : "text-navy hover:bg-black/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">تعذّر تحميل الأحداث — حاول لاحقًا.</p>
      )}

      <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
        {view === "agenda" ? (
          <AgendaView events={events} now={now} />
        ) : (
          <GridView view={view} gridStart={gridStart} days={days} anchorMonth={anchor.getMonth()} eventsByDay={eventsByDay} now={now} />
        )}
      </div>

      <Legend />
    </div>
  );
}

/* ═══════════ شبكة شهرية/أسبوعية ═══════════ */
function GridView({
  view,
  gridStart,
  days,
  anchorMonth,
  eventsByDay,
  now,
}: {
  view: ViewMode;
  gridStart: Date;
  days: number;
  anchorMonth: number;
  eventsByDay: Map<string, CalendarEvent[]>;
  now: Date;
}) {
  const cells = Array.from({ length: days }, (_, i) => addDays(gridStart, i));
  const todayKey = localKey(now);
  const maxChips = view === "week" ? 6 : 3;

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-black/5 text-center text-xs font-medium text-foreground/50">
        {WEEKDAYS_AR.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${view === "week" ? "" : "grid-rows-6"}`}>
        {cells.map((d) => {
          const key = localKey(d);
          const inMonth = view === "week" || d.getMonth() === anchorMonth;
          const isToday = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          const st = dayStatus(d);
          const dayBg = st.kind === "holiday" ? "bg-red-50/60" : st.kind === "weekend" ? "bg-black/[0.02]" : "";

          return (
            <div
              key={d.toISOString()}
              className={`flex flex-col gap-1 border-b border-l border-black/5 p-1.5 ${view === "week" ? "min-h-[220px]" : "min-h-[104px]"} ${dayBg} ${
                inMonth ? "" : "opacity-40"
              } ${isToday ? "ring-2 ring-inset ring-navy" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isToday ? "text-navy" : st.kind === "holiday" ? "text-red-700" : "text-foreground/70"}`}>
                  {d.getDate()}
                </span>
                <span className="text-[9px] leading-none text-foreground/35" title={st.kind === "holiday" ? st.label : undefined}>
                  {st.kind === "holiday" ? "🕌" : toHijri(d).slice(-2)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, maxChips).map((e) => (
                  <EventChip key={e.id} event={e} now={now} compact={view === "month"} />
                ))}
                {dayEvents.length > maxChips && (
                  <span className="px-1 text-[10px] text-foreground/50">+{dayEvents.length - maxChips} أخرى</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ قائمة (Agenda) ═══════════ */
function AgendaView({ events, now }: { events: CalendarEvent[]; now: Date }) {
  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = localKey(new Date(e.start));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-white px-5 py-12 text-center text-sm text-foreground/50">
        لا أحداث في هذه الفترة — أجندتك خالية 🌿
      </div>
    );
  }

  const todayKey = localKey(now);
  return (
    <div className="space-y-4">
      {groups.map(([key, dayEvents]) => {
        const d = new Date(dayEvents[0].start);
        const isToday = key === todayKey;
        return (
          <div key={key} className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className={`flex items-center justify-between px-4 py-2 ${isToday ? "bg-navy text-white" : "bg-black/[0.03] text-navy"}`}>
              <span className="text-sm font-semibold">
                {formatDualDate(d)}
                {isToday ? " · اليوم" : ""}
              </span>
              <span className="text-xs opacity-70">{dayEvents.length} حدث</span>
            </div>
            <div className="divide-y divide-black/5">
              {dayEvents.map((e) => (
                <AgendaRow key={e.id} event={e} now={now} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════ عناصر الحدث ═══════════ */
function urgency(event: CalendarEvent, now: Date): "past" | "urgent" | "normal" {
  const t = new Date(event.start).getTime();
  if (t < now.getTime()) return "past";
  if (t - now.getTime() <= URGENT_MS) return "urgent";
  return "normal";
}

function EventChip({ event, now, compact }: { event: CalendarEvent; now: Date; compact: boolean }) {
  const meta = CALENDAR_EVENT_META[event.type];
  const u = urgency(event, now);
  return (
    <Link
      href={event.url}
      title={event.title}
      className={`block truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight transition-colors hover:brightness-95 ${meta.chip} ${
        u === "past" ? "opacity-50" : ""
      } ${u === "urgent" ? "ring-1 ring-red-400" : ""}`}
    >
      <span>{meta.icon} </span>
      {!compact && <span className="tabular-nums">{formatTime(event.start)} </span>}
      <span>{event.title}</span>
    </Link>
  );
}

function AgendaRow({ event, now }: { event: CalendarEvent; now: Date }) {
  const meta = CALENDAR_EVENT_META[event.type];
  const u = urgency(event, now);
  return (
    <Link href={event.url} className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-navy/5 ${u === "past" ? "opacity-60" : ""}`}>
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${meta.chip}`}>{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy">{event.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-foreground/55">
          <span className="tabular-nums">{formatTime(event.start)}</span>
          {event.caseNumber && (
            <span className="font-mono text-foreground/40" dir="ltr">
              {event.caseNumber}
            </span>
          )}
          {event.location && <span>· {event.location}</span>}
          {u === "urgent" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">خلال 48 ساعة</span>}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.chip}`}>{meta.label}</span>
    </Link>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-black/5 bg-white px-5 py-3 text-xs text-foreground/60 shadow-sm">
      {CALENDAR_EVENT_ORDER.map((type) => {
        const m = CALENDAR_EVENT_META[type];
        return (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
            {m.icon} {m.label}
          </span>
        );
      })}
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-inset ring-navy" /> اليوم
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-red-50 ring-1 ring-red-400" /> عاجل (خلال 48 ساعة)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-red-50/60" /> 🕌 عطلة رسمية
      </span>
    </div>
  );
}
