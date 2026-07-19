import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isManagement, isSystemAdmin } from "@/lib/rbac";
import { getReportsStats } from "@/lib/reports-stats";
import { formatCurrency } from "@/lib/formatNumber";

const CASE_TYPE_LABELS_AR: Record<string, string> = {
  general: "عام",
  commercial: "تجارية",
  labor: "عمالية",
  personal_status: "أحوال شخصية",
  criminal: "جزائية",
  administrative: "إداري",
  committee: "لجان",
  arbitration: "تحكيم",
  debt_collection: "تحصيل ديون",
  other: "أخرى",
};

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const stats = await getReportsStats();

  const kpis = [
    { label: "قضايا مغلقة هذا الشهر", value: stats.closedThisMonth },
    { label: "معدل الكسب", value: stats.winRate !== null ? `${stats.winRate}%` : "—" },
    { label: "قضايا حُسمت وديًا", value: stats.settledAmicablyCount },
    {
      label: "إجمالي الفواتير المستحقة",
      value: formatCurrency(stats.dueInvoicesTotal),
      hint: `${stats.dueInvoicesCount} فاتورة`,
    },
  ];

  const maxTypeCount = Math.max(1, ...stats.caseTypeDistribution.map((c) => c.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">التقارير والأداء</h1>
          <p className="text-sm text-foreground/60">نظرة تحليلية على أداء المكتب</p>
        </div>
        {isSystemAdmin(session.user.role) && (
          <Link
            href="/reports/changes"
            className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
          >
            تقرير التعديلات ←
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <p className="text-sm text-foreground/50">{kpi.label}</p>
            <p className="mt-2 font-amiri text-2xl font-bold text-navy">{kpi.value}</p>
            {kpi.hint && <p className="mt-1 text-xs text-gold">{kpi.hint}</p>}
          </div>
        ))}
      </div>

      {isManagement(session.user.role) && (
        <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
          <h2 className="border-b border-black/5 px-5 py-4 font-semibold text-navy">
            أداء المحامين
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs text-foreground/50">
                  <th className="px-5 py-3 font-medium">المحامي</th>
                  <th className="px-5 py-3 font-medium">قضايا نشطة</th>
                  <th className="px-5 py-3 font-medium">جلسات هذا الشهر</th>
                  <th className="px-5 py-3 font-medium">معدل الكسب</th>
                </tr>
              </thead>
              <tbody>
                {stats.lawyerPerformance.map((l) => (
                  <tr key={l.lawyerId} className="border-b border-black/5 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy">{l.lawyerName}</td>
                    <td className="px-5 py-3">{l.activeCases}</td>
                    <td className="px-5 py-3">{l.sessionsThisMonth}</td>
                    <td className="px-5 py-3">{l.winRate !== null ? `${l.winRate}%` : "—"}</td>
                  </tr>
                ))}
                {stats.lawyerPerformance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-foreground/50">
                      لا يوجد محامون مسجّلون
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-navy">توزيع القضايا حسب صفتنا</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-foreground/60">قضايا نحن فيها مدّعون</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-navy">
              {stats.partyRoleStats.plaintiffSide.total}
            </p>
            <p className="mt-1 text-xs text-blue-700">
              معدل الكسب:{" "}
              {stats.partyRoleStats.plaintiffSide.winRate !== null
                ? `${stats.partyRoleStats.plaintiffSide.winRate}%`
                : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm text-foreground/60">قضايا نحن فيها مدّعى عليهم</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-navy">
              {stats.partyRoleStats.defendantSide.total}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              معدل الكسب:{" "}
              {stats.partyRoleStats.defendantSide.winRate !== null
                ? `${stats.partyRoleStats.defendantSide.winRate}%`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-navy">تقرير الوكالات</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs text-foreground/60">قيد إصدار الوكالة الآن</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-yellow-800">
              {stats.agencyReport.pendingAgencyCount}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-foreground/60">تأخّرت أكثر من أسبوعين</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-red-700">
              {stats.agencyReport.pendingAgencyOver14}
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <p className="text-xs text-foreground/60">وكالات تقترب من الانتهاء (30 يومًا)</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-orange-600">
              {stats.agencyReport.expiringAgencies}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-foreground/60">وكالات منتهية</p>
            <p className="mt-1 font-amiri text-2xl font-bold text-gray-700">
              {stats.agencyReport.expiredAgencies}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-navy">توزيع القضايا حسب النوع</h2>
        <div className="space-y-3">
          {stats.caseTypeDistribution.map((c) => (
            <div key={c.caseType}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{CASE_TYPE_LABELS_AR[c.caseType] ?? c.caseType}</span>
                <span className="text-foreground/50">
                  {c.count} · {c.percentage}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-black/5">
                <div
                  className="h-2 rounded-full bg-gold"
                  style={{ width: `${(c.count / maxTypeCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {stats.caseTypeDistribution.length === 0 && (
            <p className="text-sm text-foreground/50">لا توجد قضايا مسجّلة بعد</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-navy">توزيع نتائج القضايا المغلقة</h2>
          <span className="text-xs text-foreground/50">
            القضايا المحسومة صلحًا: {stats.settledCount} من أصل {stats.closedCasesCount}
          </span>
        </div>
        <div className="space-y-3">
          {stats.outcomeDistribution.map((o) => (
            <div key={o.outcome}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{o.label}</span>
                <span className="text-foreground/50">
                  {o.count} · {o.percentage}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-black/5">
                <div
                  className="h-2 rounded-full bg-taradhi"
                  style={{ width: `${o.percentage}%` }}
                />
              </div>
            </div>
          ))}
          {stats.outcomeDistribution.length === 0 && (
            <p className="text-sm text-foreground/50">لا توجد قضايا مغلقة بعد</p>
          )}
        </div>
      </div>
    </div>
  );
}
