import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";
import { dayStatus, nextHoliday } from "@/lib/judicialCalendar";
import { formatDualDate, formatTime, getDayNameAr } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ودجت التقويم العدلي: الأسبوع الحالي مع أيام العمل/العطل والجلسات + أقرب عطلة. */
export async function JudicialCalendarWidget({ user }: { user: SessionUser }) {
  const now = new Date();
  // بداية الأسبوع (الأحد).
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sessions = await prisma.session.findMany({
    where: { case: caseVisibilityWhere(user), sessionDate: { gte: weekStart, lt: weekEnd } },
    orderBy: { sessionDate: "asc" },
    include: { case: { select: { id: true, title: true } } },
  });

  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = localKey(new Date(s.sessionDate));
    const list = byDay.get(key) ?? [];
    list.push(s);
    byDay.set(key, list);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const holiday = nextHoliday(now);

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy">📅 التقويم العدلي — الأسبوع الحالي</h2>
        <Link href="/calendar" className="text-sm text-gold hover:underline">عرض الشهر كامل →</Link>
      </div>

      <ul className="divide-y divide-black/5">
        {days.map((d) => {
          const st = dayStatus(d);
          const isToday = localKey(d) === localKey(now);
          const daySessions = byDay.get(localKey(d)) ?? [];
          const off = st.kind !== "working";
          return (
            <li key={d.toISOString()} className={`px-2 py-2 ${off ? "bg-black/[0.02]" : ""} ${isToday ? "border-r-2 border-navy" : ""}`}>
              <div className="flex items-center justify-between text-sm">
                <span className={`font-medium ${off ? "text-foreground/45" : "text-navy"}`}>
                  {getDayNameAr(d)} {formatDualDate(d)}
                </span>
                <span className={`text-xs ${st.kind === "holiday" ? "font-semibold text-red-600" : st.kind === "weekend" ? "text-foreground/40" : "text-foreground/50"}`}>
                  {st.kind === "holiday" ? `🕌 ${st.label}` : st.kind === "weekend" ? "عطلة" : daySessions.length > 0 ? `${toEnglishDigits(daySessions.length)} جلسة` : "يوم عمل"}
                </span>
              </div>
              {daySessions.map((s) => (
                <Link key={s.id} href={`/cases/${s.case.id}`} className="mt-1 flex items-center gap-2 rounded-md bg-gold/10 px-2 py-1 text-xs text-navy hover:bg-gold/20">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <span className="truncate">{s.case.title}</span>
                  <span className="shrink-0 text-foreground/50" dir="ltr">{formatTime(s.sessionDate)}</span>
                </Link>
              ))}
            </li>
          );
        })}
      </ul>

      {holiday && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          ⚠️ عطلة قادمة: <span className="font-semibold">{holiday.name}</span> · {toEnglishDigits(holiday.duration)}{" "}
          {holiday.duration === 1 ? "يوم" : "أيام"} · بعد {toEnglishDigits(holiday.daysUntil)} يومًا
        </div>
      )}
    </section>
  );
}
