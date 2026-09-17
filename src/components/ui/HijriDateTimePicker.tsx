"use client";

import { useMemo, useState } from "react";
import {
  WEEKDAY_SHORT_AR,
  getHijriMonthLabel,
  getGregorianMonthLabelAr,
  getHijriDayLabel,
  getFullDualLabel,
} from "@/lib/dateUtils";
import { isJudicialHoliday, isWeekend } from "@/lib/judicialCalendar";

const pad = (n: number) => String(n).padStart(2, "0");
/** صيغة datetime-local محلية (YYYY-MM-DDTHH:mm) — نفس ما كان يُرسله input السابق. */
function toLocalValue(date: Date, time: string): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * منتقي تاريخ ووقت عربي بالكامل: عرض هجري وميلادي معًا، يبدأ بالأحد، RTL،
 * يعطّل العطل الرسمية (مع تلميح)، ويُخرج القيمة عبر input مخفي باسم `name`
 * ليعمل مع FormData كما كان input الأصلي.
 */
export function HijriDateTimePicker({
  name,
  onChange,
}: {
  name: string;
  onChange?: (value: string, date: Date) => void;
}) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<Date | null>(null);
  const [time, setTime] = useState("10:00");

  const monthLabel = useMemo(() => {
    const mid = new Date(view.y, view.m, 15);
    return `${getHijriMonthLabel(mid)} · ${getGregorianMonthLabelAr(mid)}`;
  }, [view]);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startWeekday = first.getDay(); // 0 = الأحد
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(view.y, view.m, d));
    return out;
  }, [view]);

  function move(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function pick(date: Date) {
    setSelected(date);
    if (onChange) onChange(toLocalValue(date, time), date);
  }

  function changeTime(t: string) {
    setTime(t);
    if (selected && onChange) onChange(toLocalValue(selected, t), selected);
  }

  const value = selected ? toLocalValue(selected, time) : "";

  return (
    <div dir="rtl">
      <input type="hidden" name={name} value={value} />

      <div className="rounded-xl border border-black/10 bg-white p-3">
        {/* الترويسة: تنقّل + الشهر بالصيغتين */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="الشهر السابق"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/60 transition-colors hover:bg-black/5 hover:text-navy"
          >
            ❯
          </button>
          <div className="text-center text-sm font-semibold text-navy">{monthLabel}</div>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="الشهر التالي"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/60 transition-colors hover:bg-black/5 hover:text-navy"
          >
            ❮
          </button>
        </div>

        {/* أيام الأسبوع (تبدأ بالأحد) */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-foreground/45">
          {WEEKDAY_SHORT_AR.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* شبكة الأيام */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} />;
            const holiday = isJudicialHoliday(date);
            const weekend = isWeekend(date);
            const isSelected = selected != null && sameDay(date, selected);
            const isToday = sameDay(date, today);
            const dayLabel = getHijriDayLabel(date); // للتلميح

            const base = "flex h-9 items-center justify-center rounded-lg text-sm transition-colors";
            let cls: string;
            let title: string;
            if (holiday.isHoliday) {
              cls = "cursor-not-allowed text-red-300 line-through";
              title = `عطلة رسمية (${holiday.name}) — ${dayLabel}`;
            } else if (isSelected) {
              cls = "cursor-pointer bg-navy font-bold text-white";
              title = dayLabel;
            } else if (weekend) {
              cls = "cursor-pointer text-foreground/35 hover:bg-amber-50";
              title = `نهاية أسبوع — ${dayLabel}`;
            } else {
              cls = `cursor-pointer text-navy hover:bg-gold/15 ${isToday ? "ring-1 ring-gold" : ""}`;
              title = dayLabel;
            }

            return (
              <button
                key={date.toISOString()}
                type="button"
                disabled={holiday.isHoliday}
                onClick={() => pick(date)}
                title={title}
                className={`${base} ${cls}`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {/* الوقت */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3">
          <label className="text-xs font-medium text-navy">وقت الجلسة</label>
          <input
            type="time"
            value={time}
            onChange={(e) => changeTime(e.target.value)}
            className="rounded-lg border border-black/10 px-2 py-1 text-sm outline-none focus:border-gold"
            dir="ltr"
          />
        </div>
      </div>

      {/* التاريخ المختار بالصيغتين */}
      {selected && (
        <p className="mt-2 rounded-lg bg-navy/5 px-3 py-2 text-center text-sm font-medium text-navy">
          {getFullDualLabel(selected)} — {time}
        </p>
      )}
    </div>
  );
}
