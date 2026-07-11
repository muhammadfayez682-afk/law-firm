import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { getDayNameAr, formatTime } from "@/lib/dateUtils";

function getStatusDisplay(status: string, isOverdue: boolean) {
  if (isOverdue) {
    return { label: "متأخرة", className: "bg-red-100 text-red-700" };
  }
  if (status === "amicable_settlement") {
    return { label: "قيد التسوية الودية", className: "bg-taradhi/10 text-taradhi" };
  }
  return { label: "جارية", className: "bg-orange-100 text-orange-700" };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const stats = await getDashboardStats(session.user);

  const kpis = [
    { label: "القضايا النشطة", value: stats.activeCases, accent: "border-r-navy" },
    { label: "جلسات هذا الأسبوع", value: stats.weekSessions, accent: "border-r-gold" },
    { label: "قضايا قيد تسوية قوى", value: stats.qiwaSettlementCases, accent: "border-r-taradhi" },
    { label: "مواعيد متأخرة", value: stats.overdueSessions, accent: "border-r-red-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">لوحة التحكم</h1>
        <p className="text-sm text-foreground/60">نظرة عامة على أداء المكتب</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-xl border border-black/5 border-r-4 ${kpi.accent} bg-white p-5 shadow-sm`}
          >
            <p className="text-sm text-foreground/50">{kpi.label}</p>
            <p className="mt-2 font-amiri text-3xl font-bold text-navy">{kpi.value}</p>
          </div>
        ))}
      </div>

      {stats.qiwaAlerts.length > 0 && (
        <div className="rounded-xl border border-taradhi/20 bg-[#E8F0F8] p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-taradhi">
            <span className="h-2 w-2 rounded-full bg-taradhi" />
            تنبيهات منصة قوى — التسوية الودية العمالية
          </h2>
          <ul className="space-y-2">
            {stats.qiwaAlerts.map((alert) => (
              <li key={alert.caseId}>
                <Link
                  href={`/cases/${alert.caseId}`}
                  className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-2.5 text-sm transition-colors hover:bg-white"
                >
                  <span className="font-medium text-navy">{alert.clientName}</span>
                  <span
                    className={
                      alert.daysLeft <= 5
                        ? "font-semibold text-red-600"
                        : "font-medium text-taradhi"
                    }
                  >
                    {alert.daysLeft > 0 ? `${alert.daysLeft} يومًا متبقية` : "انتهت المهلة"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
            <h2 className="font-semibold text-navy">أحدث القضايا</h2>
            <Link href="/cases" className="text-sm text-gold hover:underline">
              عرض الكل
            </Link>
          </div>

          <div className="hidden grid-cols-4 gap-4 px-5 py-2 text-xs font-medium text-foreground/50 sm:grid">
            <span>عنوان القضية</span>
            <span>العميل</span>
            <span>النوع</span>
            <span>الحالة</span>
          </div>

          <div className="divide-y divide-black/5">
            {stats.recentCases.map((c) => {
              const statusDisplay = getStatusDisplay(c.status, c.isOverdue);
              return (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="grid grid-cols-1 gap-1 px-5 py-3 text-sm transition-colors hover:bg-navy/5 sm:grid-cols-4 sm:gap-4 sm:items-center"
                >
                  <span className="truncate font-medium text-navy">{c.title}</span>
                  <span className="truncate text-foreground/70">{c.clientName}</span>
                  <span className="text-foreground/70">{c.caseTypeLabel}</span>
                  <span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusDisplay.className}`}
                    >
                      {statusDisplay.label}
                    </span>
                  </span>
                </Link>
              );
            })}
            {stats.recentCases.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-foreground/50">
                لا توجد قضايا بعد
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-navy">الجلسات القادمة</h2>
          {stats.upcomingSessions.length === 0 ? (
            <p className="text-sm text-foreground/50">لا توجد جلسات قادمة</p>
          ) : (
            <ul className="space-y-3">
              {stats.upcomingSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/cases/${s.caseId}`}
                    className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-navy/5"
                  >
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        s.isTaradhi ? "bg-taradhi" : "bg-gold"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy">{s.caseTitle}</p>
                      <p className="text-xs text-foreground/50">
                        {getDayNameAr(s.sessionDate)} {formatTime(s.sessionDate)}
                        {" · "}
                        {s.sessionTypeLabel}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
