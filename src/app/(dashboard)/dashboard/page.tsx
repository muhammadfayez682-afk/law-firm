import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { getDayNameAr, formatTime } from "@/lib/dateUtils";
import { isSystemAdmin } from "@/lib/rbac";
import { toEnglishDigits } from "@/lib/formatNumber";

/** لون عدّاد الأيام حسب التأخّر: أصفر > 3، برتقالي > 7، أحمر > 14. */
function pendingAgencyDayColor(days: number): string {
  if (days > 14) return "text-red-700";
  if (days > 7) return "text-orange-600";
  if (days > 3) return "text-yellow-700";
  return "text-foreground/60";
}

function getStatusDisplay(status: string, isOverdue: boolean) {
  if (isOverdue) {
    return { label: "متأخرة", className: "bg-red-100 text-red-700" };
  }
  if (status === "amicable_settlement") {
    return { label: "قيد التسوية الودية", className: "bg-taradhi/10 text-taradhi" };
  }
  if (status === "pending_agency") {
    return { label: "قيد إصدار الوكالة", className: "bg-yellow-100 text-yellow-800" };
  }
  return { label: "جارية", className: "bg-orange-100 text-orange-700" };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const stats = await getDashboardStats(session.user);
  const role = session.user.role;

  // مؤشرات المهام الشخصية.
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [myPendingTasks, overdueTasks, completedTasksThisWeek] = await Promise.all([
    prisma.task.count({ where: { assignedToId: session.user.id, status: { in: ["pending", "in_progress"] } } }),
    prisma.task.count({
      where: { assignedToId: session.user.id, status: { in: ["pending", "in_progress"] }, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: { assignedToId: session.user.id, status: "completed", completedAt: { gte: weekAgo } },
    }),
  ]);

  // مؤشرات لوحة التحكم تتكيّف مع دور المستخدم.
  let kpis: { label: string; value: number; accent: string }[];
  if (role === "researcher") {
    kpis = [
      { label: "مذكراتي قيد الكتابة", value: stats.myDraftMemos, accent: "border-r-navy" },
      { label: "تعديلات مطلوبة", value: stats.myChangesRequestedMemos, accent: "border-r-orange-500" },
      { label: "مذكرات معتمدة", value: stats.myApprovedMemos, accent: "border-r-emerald-500" },
      { label: "قضاياي النشطة", value: stats.activeCases, accent: "border-r-gold" },
    ];
  } else if (role === "lawyer") {
    kpis = [
      { label: "مذكرات بانتظار مراجعتي", value: stats.memosAwaitingReview, accent: "border-r-blue-500" },
      { label: "جلسات هذا الأسبوع", value: stats.weekSessions, accent: "border-r-gold" },
      { label: "قضاياي النشطة", value: stats.activeCases, accent: "border-r-navy" },
      { label: "مواعيد متأخرة", value: stats.overdueSessions, accent: "border-r-red-500" },
    ];
  } else {
    kpis = [
      { label: "القضايا النشطة", value: stats.activeCases, accent: "border-r-navy" },
      { label: "جلسات هذا الأسبوع", value: stats.weekSessions, accent: "border-r-gold" },
      { label: "قضايا قيد تسوية قوى", value: stats.qiwaSettlementCases, accent: "border-r-taradhi" },
      { label: "مواعيد متأخرة", value: stats.overdueSessions, accent: "border-r-red-500" },
    ];
  }

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
            <p className="mt-2 font-amiri text-3xl font-bold text-navy">
              {toEnglishDigits(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/tasks?status=pending" className="rounded-xl border border-black/5 border-r-4 border-r-navy bg-white px-5 py-4 shadow-sm hover:bg-navy/5">
          <p className="text-sm text-foreground/50">مهامي المعلقة</p>
          <p className="mt-1 font-amiri text-2xl font-bold text-navy">{toEnglishDigits(myPendingTasks)}</p>
        </Link>
        <Link href="/tasks?status=overdue" className={`rounded-xl border border-r-4 px-5 py-4 shadow-sm ${overdueTasks > 0 ? "border-red-200 border-r-red-500 bg-red-50 hover:bg-red-100" : "border-black/5 border-r-red-500 bg-white hover:bg-navy/5"}`}>
          <p className="text-sm text-foreground/50">مهام متأخرة</p>
          <p className={`mt-1 font-amiri text-2xl font-bold ${overdueTasks > 0 ? "text-red-700" : "text-navy"}`}>{toEnglishDigits(overdueTasks)}</p>
        </Link>
        <Link href="/tasks" className="rounded-xl border border-black/5 border-r-4 border-r-emerald-500 bg-white px-5 py-4 shadow-sm hover:bg-navy/5">
          <p className="text-sm text-foreground/50">أُنجزت هذا الأسبوع</p>
          <p className="mt-1 font-amiri text-2xl font-bold text-navy">{toEnglishDigits(completedTasksThisWeek)}</p>
        </Link>
      </div>

      {isSystemAdmin(role) && stats.pendingClosureCount > 0 && (
        <Link
          href="/cases?status=pending_closure"
          className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 transition-colors hover:bg-amber-100"
        >
          <span className="font-semibold text-amber-800">
            طلبات إغلاق بانتظار اعتمادك: {toEnglishDigits(stats.pendingClosureCount)}
          </span>
          <span className="text-sm text-amber-700">عرض القضايا ←</span>
        </Link>
      )}

      {isSystemAdmin(role) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link href="/intake?status=conflict_check" className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-4 hover:bg-purple-100">
            <p className="text-sm text-purple-700">طلبات جديدة بانتظار التقييم</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-navy">
              {toEnglishDigits(stats.intakeAwaitingAssessment)}
            </p>
          </Link>
          <Link href="/intake?status=under_assessment" className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 hover:bg-orange-100">
            <p className="text-sm text-orange-700">طلبات بانتظار قرارك</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-navy">
              {toEnglishDigits(stats.intakeAwaitingDecision)}
            </p>
          </Link>
          {stats.intakeConfirmedConflicts > 0 ? (
            <Link href="/intake" className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 hover:bg-red-100">
              <p className="text-sm font-semibold text-red-700">⚠️ تعارض مصالح مؤكد يحتاج مراجعتك</p>
              <p className="mt-1 font-amiri text-2xl font-bold text-red-700">
                {toEnglishDigits(stats.intakeConfirmedConflicts)}
              </p>
            </Link>
          ) : (
            <div className="rounded-xl border border-black/5 bg-white px-5 py-4">
              <p className="text-sm text-foreground/50">طلبات استقبلتها هذا الشهر</p>
              <p className="mt-1 font-amiri text-2xl font-bold text-navy">
                {toEnglishDigits(stats.myIntakesThisMonth)}
              </p>
            </div>
          )}
        </div>
      )}

      {(isSystemAdmin(role) || role === "supervisor") && stats.pendingAgencyCases.length > 0 && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-yellow-900">
            ⏳ قضايا قيد إصدار الوكالة: {toEnglishDigits(stats.pendingAgencyCases.length)}
          </h2>
          <ul className="space-y-2">
            {stats.pendingAgencyCases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-4 py-2.5 text-sm transition-colors hover:bg-white"
                >
                  <span className="font-medium text-navy" dir="ltr">{c.displayNumber}</span>
                  <span className="text-foreground/70">{c.clientName}</span>
                  <span className="text-xs text-foreground/50">{c.lawyerName}</span>
                  <span className={`font-semibold ${pendingAgencyDayColor(c.daysSince)}`}>
                    {toEnglishDigits(c.daysSince)} {c.daysSince === 1 ? "يوم" : "يومًا"}
                  </span>
                  <span className="text-xs text-yellow-700">متابعة ←</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
