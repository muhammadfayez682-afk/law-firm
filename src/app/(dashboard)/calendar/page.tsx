import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, caseVisibilityWhere, isManagement } from "@/lib/rbac";
import { formatTime, getHijriMonthLabel } from "@/lib/dateUtils";

const SESSION_TYPE_LABELS_AR: Record<string, string> = {
  negotiation_meeting: "جلسة تسوية ودية",
  hearing: "مرافعة",
  initial_listening: "استماع",
  verdict: "نطق حكم",
  arbitration: "تحكيم",
};

const WEEKDAY_LABELS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const QIWA_ALERT_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;
  const now = new Date();
  const [year, month] = params.month
    ? params.month.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const monthStart = new Date(year, month - 1, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridDays = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const gridEnd = gridDays[gridDays.length - 1];
  const gridEndInclusive = new Date(gridEnd);
  gridEndInclusive.setHours(23, 59, 59, 999);

  const prevMonth = new Date(year, month - 2, 1);
  const nextMonth = new Date(year, month, 1);

  const caseWhere = caseVisibilityWhere(session.user);

  const [monthSessions, upcomingSessions, laborCases] = await Promise.all([
    prisma.session.findMany({
      where: { case: caseWhere, sessionDate: { gte: gridStart, lte: gridEndInclusive } },
      include: { case: true },
    }),
    prisma.session.findMany({
      where: { case: caseWhere, sessionDate: { gte: now } },
      orderBy: { sessionDate: "asc" },
      take: 10,
      include: { case: { include: { client: true } } },
    }),
    prisma.case.findMany({
      where: { ...caseWhere, caseType: "labor", status: "amicable_settlement" },
      include: { client: true, amicableSettlement: true },
    }),
  ]);

  const sessionsByDay = new Map<string, typeof monthSessions>();
  for (const s of monthSessions) {
    const key = dateKey(new Date(s.sessionDate));
    const list = sessionsByDay.get(key) ?? [];
    list.push(s);
    sessionsByDay.set(key, list);
  }

  const qiwaExpiring = laborCases
    .map((c) => {
      const deadline = c.amicableSettlement?.deadlineDate;
      if (!deadline) return null;
      const daysLeft = Math.ceil((new Date(deadline).getTime() - now.getTime()) / MS_PER_DAY);
      return { caseId: c.id, clientName: c.client.fullName, daysLeft };
    })
    .filter((c): c is { caseId: string; clientName: string; daysLeft: number } => c !== null)
    .filter((c) => c.daysLeft < QIWA_ALERT_THRESHOLD_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">التقويم والجلسات</h1>
        <p className="text-sm text-foreground/60">الجلسات والمواعيد ومهل التسوية الودية</p>
      </div>

      {qiwaExpiring.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="mb-3 font-semibold text-red-700">مهل قوى تنتهي قريبًا</h2>
          <ul className="space-y-2">
            {qiwaExpiring.map((item) => (
              <li key={item.caseId}>
                <Link
                  href={`/cases/${item.caseId}`}
                  className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm hover:bg-red-100/50"
                >
                  <span className="font-medium text-navy">{item.clientName}</span>
                  <span className="font-semibold text-red-600">
                    {item.daysLeft > 0 ? `${item.daysLeft} أيام متبقية` : "انتهت المهلة"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.6fr]">
        {/* قائمة الجلسات القادمة — يمين */}
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-navy">الجلسات القادمة</h2>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-foreground/50">لا توجد جلسات قادمة</p>
          ) : (
            <ul className="space-y-3">
              {upcomingSessions.map((s) => {
                const isTaradhi = s.sessionType === "negotiation_meeting";
                return (
                  <li key={s.id}>
                    <Link
                      href={`/cases/${s.caseId}`}
                      className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-navy/5"
                    >
                      <span
                        className={`mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          isTaradhi ? "bg-taradhi/10 text-taradhi" : "bg-gold/10 text-gold"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5">
                          {isTaradhi ? (
                            <path
                              d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8z"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : (
                            <path
                              d="M3 7h18M3 7l1.5 12a1 1 0 001 1h13a1 1 0 001-1L21 7M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy">{s.case.title}</p>
                        <p className="text-xs text-foreground/50">
                          {new Date(s.sessionDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {" · "}
                          {formatTime(s.sessionDate)}
                        </p>
                        <p className={`text-xs ${isTaradhi ? "text-taradhi" : "text-foreground/50"}`}>
                          {SESSION_TYPE_LABELS_AR[s.sessionType]}
                          {s.court ? ` · ${s.court}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* التقويم الشهري — يسار */}
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={`/calendar?month=${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-navy hover:bg-black/5"
            >
              السابق
            </Link>
            <h2 className="font-amiri text-lg font-bold text-navy">
              {monthStart.toLocaleDateString("en-US", { year: "numeric", month: "long" })}
              {" — "}
              {getHijriMonthLabel(monthStart)}
            </h2>
            <Link
              href={`/calendar?month=${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-navy hover:bg-black/5"
            >
              التالي
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-foreground/50">
            {WEEKDAY_LABELS_AR.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {gridDays.map((d) => {
              const inMonth = d.getMonth() === monthStart.getMonth();
              const isToday = isSameDay(d, now);
              const daySessions = sessionsByDay.get(dateKey(d)) ?? [];
              const hasCourt = daySessions.some((s) => s.sessionType !== "negotiation_meeting");
              const hasTaradhi = daySessions.some((s) => s.sessionType === "negotiation_meeting");

              return (
                <div
                  key={d.toISOString()}
                  className={`flex h-16 flex-col items-center justify-start rounded-lg border p-1.5 text-sm ${
                    isToday ? "border-2 border-navy" : "border-black/5"
                  } ${inMonth ? "text-navy" : "text-foreground/25"}`}
                >
                  <span>{d.getDate()}</span>
                  <div className="mt-1 flex gap-1">
                    {hasCourt && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                    {hasTaradhi && <span className="h-1.5 w-1.5 rounded-full bg-taradhi" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-black/5 pt-4 text-xs text-foreground/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gold" /> جلسة محكمة
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-taradhi" /> جلسة تسوية ودية
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded border-2 border-navy" /> اليوم الحالي
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
