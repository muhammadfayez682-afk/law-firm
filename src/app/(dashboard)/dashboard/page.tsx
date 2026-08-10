import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAccountantDashboard,
  getAdminDashboard,
  getLawyerDashboard,
  getResearcherDashboard,
  getSecretaryDashboard,
  getMyTasks,
  getMySessions,
} from "@/lib/dashboard-role";
import type { SessionUser } from "@/lib/rbac";
import { formatDualDate, formatTime, getDayNameAr } from "@/lib/dateUtils";
import { toEnglishDigits, formatCurrency } from "@/lib/formatNumber";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { SERVICE_STATUS_LABELS_AR, SERVICE_STATUS_STYLES } from "@/lib/services";
import { JudicialCalendarWidget } from "@/components/dashboard/JudicialCalendarWidget";
import { MyTasksWidget } from "@/components/dashboard/MyTasksWidget";
import { MySessionsWidget } from "@/components/dashboard/MySessionsWidget";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import {
  DASHBOARD_WIDGETS,
  DEFAULT_VISIBLE_WIDGETS,
  sanitizeWidgets,
  type DashboardWidgetId,
} from "@/lib/dashboardWidgets";

/** الودجتات الظاهرة للمستخدم — المحفوظة أو الافتراضية. */
async function loadVisibleWidgets(userId: string): Promise<DashboardWidgetId[]> {
  const pref = await prisma.userDashboardPreference.findUnique({ where: { userId } });
  return pref ? sanitizeWidgets(pref.visibleWidgets) : DEFAULT_VISIBLE_WIDGETS;
}

/** بيانات لوحة الدور — تُجلب مرة واحدة وتُستخدم في شريط الأرقام والتفاصيل معًا. */
type RoleData =
  | { role: "lawyer"; d: Awaited<ReturnType<typeof getLawyerDashboard>> }
  | { role: "researcher"; d: Awaited<ReturnType<typeof getResearcherDashboard>> }
  | { role: "admin"; d: Awaited<ReturnType<typeof getAdminDashboard>> }
  | { role: "secretary"; d: Awaited<ReturnType<typeof getSecretaryDashboard>> }
  | { role: "accountant"; d: Awaited<ReturnType<typeof getAccountantDashboard>> };

async function getRoleData(user: SessionUser): Promise<RoleData> {
  switch (user.role) {
    case "researcher":
      return { role: "researcher", d: await getResearcherDashboard(user) };
    case "secretary":
      return { role: "secretary", d: await getSecretaryDashboard() };
    case "accountant":
      return { role: "accountant", d: await getAccountantDashboard() };
    case "system_admin":
    case "supervisor":
      return { role: "admin", d: await getAdminDashboard() };
    default:
      return { role: "lawyer", d: await getLawyerDashboard(user) };
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user;
  const role = user.role;

  const visible = new Set(await loadVisibleWidgets(user.id));
  const needRole = visible.has("kpis") || visible.has("role_overview");

  // نجلب بيانات الودجتات الظاهرة فقط (توفيرًا للاستعلامات).
  const [myTasks, mySessions, roleData] = await Promise.all([
    visible.has("my_tasks") ? getMyTasks(user) : Promise.resolve([]),
    visible.has("my_sessions") ? getMySessions(user) : Promise.resolve([]),
    needRole ? getRoleData(user) : Promise.resolve(null),
  ]);

  const bothPersonal = visible.has("my_tasks") && visible.has("my_sessions");

  return (
    <div className="space-y-6">
      {/* 1) ترحيب + تخصيص اللوحة */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">لوحة التحكم</h1>
          <p className="text-sm text-foreground/60">
            {role === "lawyer" && "يومك ومهامك وجلساتك"}
            {role === "researcher" && "مذكراتك وأبحاثك"}
            {(role === "system_admin" || role === "supervisor") && "نظرة عامة على المكتب وصحة النظام"}
            {role === "secretary" && "الاستلام والمواعيد والوكالات"}
            {role === "accountant" && "الفواتير والتحصيلات والمصاريف"}
          </p>
        </div>
        <DashboardCustomizer widgets={DASHBOARD_WIDGETS} visible={Array.from(visible)} />
      </div>

      {/* 2) شريط الأرقام السريعة المضغوط */}
      {visible.has("kpis") && roleData && <RoleKpiBar roleData={roleData} />}

      {/* 3) العمل اليومي: مهامي (يمين) + جلساتي القادمة (يسار) */}
      {(visible.has("my_tasks") || visible.has("my_sessions")) &&
        (bothPersonal ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MyTasksWidget tasks={myTasks} />
            <MySessionsWidget sessions={mySessions} />
          </div>
        ) : (
          <>
            {visible.has("my_tasks") && <MyTasksWidget tasks={myTasks} />}
            {visible.has("my_sessions") && <MySessionsWidget sessions={mySessions} />}
          </>
        ))}

      {/* 4) التقويم العدلي المصغّر (يقود للعرض الكامل) */}
      {visible.has("judicial_calendar") && <JudicialCalendarWidget user={user} />}

      {/* 5) تفاصيل لوحة الدور (قوائم وتنبيهات) */}
      {visible.has("role_overview") && roleData && <RoleLists roleData={roleData} />}

      {visible.size === 0 && (
        <p className="rounded-xl border border-dashed border-black/10 bg-white px-5 py-10 text-center text-sm text-foreground/50">
          كل الودجتات مخفية — استخدم «⚙️ تخصيص اللوحة» لإظهار ما تريد.
        </p>
      )}
    </div>
  );
}

/* ═══════════ شريط الأرقام السريعة (KPIs مضغوط) ═══════════ */
type Chip = { label: string; value: number; money?: boolean; href?: string; tone?: string };

function kpiChips(roleData: RoleData): Chip[] {
  switch (roleData.role) {
    case "lawyer": {
      const d = roleData.d;
      return [
        { label: "مهام متأخرة", value: d.needsDecision.overdueTasks, href: "/tasks?status=overdue", tone: "red" },
        { label: "مهام اليوم", value: d.alerts.tasksDueToday, href: "/tasks", tone: "amber" },
        { label: "مذكرات بانتظار مراجعتك", value: d.alerts.memosAwaitingReview, href: "/memos?status=submitted", tone: "orange" },
        { label: "مذكرات تعديلات", value: d.needsDecision.memosChangesRequested, href: "/memos", tone: "orange" },
        { label: "خدمات مراجعة", value: d.needsDecision.servicesUnderReview, href: "/services?status=under_review", tone: "amber" },
        { label: "قضاياي", value: d.stats.myCasesCount, href: "/cases", tone: "navy" },
        { label: "خدماتي", value: d.stats.myServicesCount, href: "/services", tone: "navy" },
      ];
    }
    case "researcher": {
      const d = roleData.d;
      return [
        { label: "قيد الكتابة", value: d.drafts.length, href: "/memos", tone: "navy" },
        { label: "تعديلات مطلوبة", value: d.changesRequested.length, href: "/memos", tone: "orange" },
        { label: "معتمدة هذا الأسبوع", value: d.approvedThisWeek, href: "/memos", tone: "emerald" },
        { label: "مهامي", value: d.myTasks.length, href: "/tasks", tone: "navy" },
      ];
    }
    case "admin": {
      const d = roleData.d;
      return [
        { label: "طلبات استلام جديدة", value: d.overview.newIntakes, href: "/intake", tone: "navy" },
        { label: "تعارض مؤكد", value: d.overview.confirmedConflicts, href: "/intake", tone: "red" },
        { label: "طلبات إغلاق بانتظارك", value: d.overview.pendingClosures, href: "/cases?status=pending_closure", tone: "amber" },
        { label: "تفعيلات معلّقة", value: d.overview.pendingActivations, href: "/intake?status=fee_agreement_pending", tone: "navy" },
        { label: "قضايا متأخرة الوكالة", value: d.health.agencyOverdue, href: "/cases?status=pending_agency", tone: "red" },
        { label: "مهل تسوية خلال أسبوع", value: d.health.settlementSoon, href: "/cases", tone: "amber" },
        { label: "وكالات تنتهي خلال شهر", value: d.health.agenciesExpiring, href: "/reports", tone: "orange" },
        { label: "خدمات متأخرة", value: d.health.overdueServices, href: "/services", tone: "red" },
        { label: "فواتير مستحقة", value: d.finance.dueTotal, money: true, href: "/invoices", tone: "gold" },
        { label: "تحصيلات هذا الشهر", value: d.finance.paidThisMonth, money: true, tone: "gold" },
        { label: "إيرادات الخدمات", value: d.finance.serviceRevenue, money: true, tone: "gold" },
      ];
    }
    case "secretary": {
      const d = roleData.d;
      return [
        { label: "طلبات استلام اليوم", value: d.todayIntakes, href: "/intake", tone: "navy" },
        { label: "جلسات هذا الأسبوع", value: d.weekSessionsCount, href: "/sessions", tone: "gold" },
      ];
    }
    case "accountant": {
      const d = roleData.d;
      return [
        { label: "فواتير مستحقة", value: d.dueTotal, money: true, href: "/invoices", tone: "gold" },
        { label: "فواتير متأخرة", value: d.overdueTotal, money: true, href: "/invoices", tone: "red" },
        { label: "تحصيلات هذا الشهر", value: d.paidThisMonth, money: true, tone: "emerald" },
        { label: "مصاريف هذا الشهر", value: d.expensesThisMonth, money: true, tone: "amber" },
        { label: "إيرادات الخدمات", value: d.serviceRevenue, money: true, tone: "gold" },
      ];
    }
  }
}

function RoleKpiBar({ roleData }: { roleData: RoleData }) {
  const chips = kpiChips(roleData);
  if (chips.length === 0) return null;
  return (
    <section className="flex flex-wrap gap-3">
      {chips.map((c) => (
        <StatChip key={c.label} {...c} />
      ))}
    </section>
  );
}

/* ═══════════ تفاصيل لوحة الدور (قوائم وتنبيهات — بلا أرقام مكرّرة) ═══════════ */
function RoleLists({ roleData }: { roleData: RoleData }) {
  switch (roleData.role) {
    case "lawyer": {
      const d = roleData.d;
      return (
        <div className="space-y-6">
          <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-navy">جلسات هذا الأسبوع</h2>
            {d.weekSessions.length === 0 ? (
              <p className="text-sm text-foreground/50">لا جلسات هذا الأسبوع — أسبوع هادئ 🌿</p>
            ) : (
              <ul className="space-y-3">
                {d.weekSessions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-black/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/cases/${s.caseId}`} className="text-sm font-medium text-navy hover:underline">
                        {s.caseTitle} <span className="font-mono text-xs text-foreground/40" dir="ltr">{s.caseNumber}</span>
                      </Link>
                      <span className="text-xs text-foreground/60">
                        {getDayNameAr(s.sessionDate)} {formatTime(s.sessionDate)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                        <div className={`h-full ${s.prepProgress === 100 ? "bg-emerald-500" : "bg-taradhi"}`} style={{ width: `${s.prepProgress}%` }} />
                      </div>
                      <span className="text-xs text-foreground/50">تحضير {s.prepProgress}%</span>
                      {s.criticalPending > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">⚠️ حرج</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ListCard title="قضاياي النشطة" href="/cases">
              {d.myCases.map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-navy/5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy">{c.title}</span>
                    <span className="block text-xs text-foreground/50">{c.clientName}{c.nextSession ? ` · جلسة ${formatDualDate(c.nextSession)}` : ""}</span>
                  </span>
                  <CaseStatusBadge status={c.status} />
                </Link>
              ))}
              {d.myCases.length === 0 && <p className="px-4 py-6 text-center text-sm text-foreground/50">لا توجد قضايا</p>}
            </ListCard>

            <ListCard title="خدماتي النشطة" href="/services">
              {d.myServices.map((s) => (
                <Link key={s.id} href={`/services/${s.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-navy/5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy">{s.title}</span>
                    <span className="block text-xs text-foreground/50">{s.clientName} · <span dir="ltr">{s.number}</span></span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${SERVICE_STATUS_STYLES[s.status]}`}>
                    {SERVICE_STATUS_LABELS_AR[s.status]}
                  </span>
                </Link>
              ))}
              {d.myServices.length === 0 && <p className="px-4 py-6 text-center text-sm text-foreground/50">لا توجد خدمات</p>}
            </ListCard>
          </div>
        </div>
      );
    }
    case "researcher": {
      const d = roleData.d;
      return (
        <div className="space-y-6">
          {d.changesRequested.length > 0 && (
            <section className="rounded-xl border-2 border-orange-200 bg-orange-50 p-5">
              <h2 className="mb-3 font-semibold text-orange-800">✏️ مذكرات طُلبت لها تعديلات</h2>
              <ul className="space-y-2">
                {d.changesRequested.map((m) => (
                  <li key={m.id}>
                    <Link href={`/memos/${m.id}`} className="flex items-center justify-between rounded-lg bg-white/80 px-4 py-2.5 text-sm hover:bg-white">
                      <span className="font-medium text-navy">{m.title}</span>
                      <span className="font-mono text-xs text-foreground/50" dir="ltr">{m.caseNumber}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ListCard title="قضايا أعمل عليها" href="/cases">
              {d.myCases.map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-navy/5">
                  <span className="truncate font-medium text-navy">{c.title}</span>
                  <span className="font-mono text-xs text-foreground/50" dir="ltr">{c.number}</span>
                </Link>
              ))}
              {d.myCases.length === 0 && <p className="px-4 py-6 text-center text-sm text-foreground/50">—</p>}
            </ListCard>
            <ListCard title="خدمات أعمل عليها" href="/services">
              {d.myServices.map((s) => (
                <Link key={s.id} href={`/services/${s.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-navy/5">
                  <span className="truncate font-medium text-navy">{s.title}</span>
                  <span className="font-mono text-xs text-foreground/50" dir="ltr">{s.number}</span>
                </Link>
              ))}
              {d.myServices.length === 0 && <p className="px-4 py-6 text-center text-sm text-foreground/50">—</p>}
            </ListCard>
          </div>
        </div>
      );
    }
    case "admin":
      // كل مؤشرات المسؤول أرقام سريعة — لا قوائم إضافية.
      return null;
    case "secretary": {
      const d = roleData.d;
      return (
        <div className="space-y-6">
          <ListCard title="المواعيد القادمة" href="/sessions">
            {d.upcomingSessions.map((s) => (
              <Link key={s.id} href={`/cases/${s.caseId}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-navy/5">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-navy">{s.caseTitle}</span>
                  <span className="block text-xs text-foreground/50" dir="ltr">{s.caseNumber}</span>
                </span>
                <span className="text-xs text-foreground/60">
                  {getDayNameAr(s.sessionDate)} {formatTime(s.sessionDate)}
                  {s.sessionMode !== "in_person" ? " · عن بُعد" : ""}
                </span>
              </Link>
            ))}
            {d.upcomingSessions.length === 0 && <p className="px-4 py-6 text-center text-sm text-foreground/50">لا مواعيد قادمة</p>}
          </ListCard>

          <ListCard title="⏳ وكالات قاربت على الانتهاء" href="/clients">
            {d.expiringAgencies.map((a) => (
              <Link key={a.id} href={`/clients/${a.clientId}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-navy/5">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-navy">{a.clientName}</span>
                  <span className="block font-mono text-xs text-foreground/50" dir="ltr">{a.agencyNumber}</span>
                </span>
                <span className={`text-xs font-semibold ${a.daysLeft <= 7 ? "text-red-600" : "text-orange-600"}`}>
                  {toEnglishDigits(a.daysLeft)} يومًا
                </span>
              </Link>
            ))}
            {d.expiringAgencies.length === 0 && <p className="px-4 py-6 text-center text-sm text-foreground/50">لا وكالات قاربت على الانتهاء</p>}
          </ListCard>
        </div>
      );
    }
    case "accountant":
      return (
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm text-foreground/50">روابط سريعة</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/invoices" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">الفواتير والمصاريف</Link>
            <Link href="/services" className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5">الخدمات</Link>
          </div>
        </div>
      );
  }
}

/* ═══════════ مكوّنات مشتركة ═══════════ */
const DOT_TONES: Record<string, string> = {
  navy: "bg-navy",
  red: "bg-red-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  emerald: "bg-emerald-500",
  gold: "bg-gold",
};

/** رقاقة رقم مضغوطة لشريط الأرقام السريعة. */
function StatChip({ label, value, money, href, tone = "navy" }: Chip) {
  const inner = (
    <div className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-white px-4 py-2.5 shadow-sm transition-colors hover:bg-navy/5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_TONES[tone] ?? DOT_TONES.navy}`} />
      <span className="font-amiri text-lg font-bold text-navy">
        {money ? formatCurrency(value) : toEnglishDigits(value)}
      </span>
      <span className="text-xs text-foreground/60">{label}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ListCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <h2 className="font-semibold text-navy">{title}</h2>
        <Link href={href} className="text-sm text-gold hover:underline">عرض الكل</Link>
      </div>
      <div className="divide-y divide-black/5">{children}</div>
    </section>
  );
}
