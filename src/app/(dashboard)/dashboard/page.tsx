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
  getCriticalDates,
  getDashboardCounts,
  getActiveCasesWidget,
  getPendingMemos,
  type DashboardCounts,
} from "@/lib/dashboard-role";
import type { SessionUser } from "@/lib/rbac";
import { formatDualDate, formatTime, getDayNameAr } from "@/lib/dateUtils";
import { toEnglishDigits, formatCurrency } from "@/lib/formatNumber";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { SERVICE_STATUS_LABELS_AR, SERVICE_STATUS_STYLES } from "@/lib/services";
import { JudicialCalendarWidget } from "@/components/dashboard/JudicialCalendarWidget";
import { MyTasksWidget } from "@/components/dashboard/MyTasksWidget";
import { MySessionsWidget } from "@/components/dashboard/MySessionsWidget";
import { ActiveCasesWidget } from "@/components/dashboard/ActiveCasesWidget";
import { MyMemosWidget } from "@/components/dashboard/MyMemosWidget";
import { CriticalDatesWidget } from "@/components/dashboard/CriticalDatesWidget";
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
  const [myTasks, mySessions, criticalDates, roleData, counts, activeCases, pendingMemos] = await Promise.all([
    visible.has("my_tasks") ? getMyTasks(user) : Promise.resolve([]),
    visible.has("my_sessions") ? getMySessions(user) : Promise.resolve([]),
    visible.has("critical_dates") ? getCriticalDates(user) : Promise.resolve([]),
    needRole ? getRoleData(user) : Promise.resolve(null),
    visible.has("kpis") ? getDashboardCounts(user) : Promise.resolve(null),
    visible.has("active_cases") ? getActiveCasesWidget(user) : Promise.resolve([]),
    visible.has("my_memos") ? getPendingMemos(user) : Promise.resolve([]),
  ]);

  // الودجتات الأساسية الأربعة (شبكة 2×2).
  const coreWidgets = ["active_cases", "my_sessions", "my_memos", "my_tasks"] as const;
  const hasAnyCore = coreWidgets.some((w) => visible.has(w));

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

      {/* 2) شريط المؤشرات ذو المستويات الثلاثة (يحتاج انتباهك / نظرة عامة / أخرى) */}
      {visible.has("kpis") && roleData && counts && (
        <IndicatorBar counts={counts} roleData={roleData} />
      )}

      {/* 2.ب التواريخ الحرجة (مهل استئناف/متابعة) — بارزة أعلى العمل اليومي */}
      {visible.has("critical_dates") && <CriticalDatesWidget items={criticalDates} />}

      {/* 3) الودجتات الأساسية (شبكة 2×2): القضايا · الجلسات · المذكرات · المهام */}
      {hasAnyCore && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <span className="text-base">🧩</span> الودجتات الأساسية
          </h2>
          {/* تخطيط Masonry بأعمدة CSS: كل ودجت يترصّ حسب ارتفاعه الفعلي بلا فراغات.
              عمود واحد على الجوال، عمودان على الديسكتوب. break-inside-avoid يمنع تقسيم الودجت،
              وmb-5 يوفّر التباعد الرأسي (لأن أعمدة CSS لا تستخدم gap الرأسي). RTL يتدفّق من اليمين. */}
          <div className="columns-1 gap-5 lg:columns-2 [&>section]:mb-5 [&>section]:break-inside-avoid">
            {visible.has("active_cases") && <ActiveCasesWidget cases={activeCases} />}
            {visible.has("my_sessions") && <MySessionsWidget sessions={mySessions} />}
            {visible.has("my_memos") && <MyMemosWidget memos={pendingMemos} />}
            {visible.has("my_tasks") && <MyTasksWidget tasks={myTasks} />}
          </div>
        </section>
      )}

      {/* 4) التقويم العدلي المصغّر (يقود للعرض الكامل) */}
      {visible.has("judicial_calendar") && <JudicialCalendarWidget user={user} />}

      {/* 5) تفاصيل لوحة الدور الإضافية (اختياري) */}
      {visible.has("role_overview") && roleData && <RoleLists roleData={roleData} />}

      {visible.size === 0 && (
        <p className="rounded-xl border border-dashed border-black/10 bg-white px-5 py-10 text-center text-sm text-foreground/50">
          كل الودجتات مخفية — استخدم «⚙️ تخصيص اللوحة» لإظهار ما تريد.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════ شريط المؤشرات ذو المستويات الثلاثة ═══════════════════ */

/** المستوى الأول — بطاقة حرجة بارزة (تظهر فقط إن كانت قيمتها > 0). */
type AttentionItem = {
  key: string;
  value: number;
  icon: string;
  title: string;
  href: string;
  linkLabel: string;
  tone: "red" | "amber";
};

const ATTENTION_TONES: Record<"red" | "amber", { box: string; num: string; link: string }> = {
  red: { box: "border-red-200 bg-red-50", num: "text-red-600", link: "text-red-700" },
  amber: { box: "border-amber-200 bg-amber-50", num: "text-amber-600", link: "text-amber-700" },
};

function attentionItems(counts: DashboardCounts): AttentionItem[] {
  const items: AttentionItem[] = [
    { key: "no_agency", value: counts.noAgency, icon: "🚫", title: "قضايا نشطة بلا وكالة", href: "/cases?status=pending_agency", linkLabel: "عرض القضايا", tone: "red" },
    { key: "agencies_expiring", value: counts.agenciesExpiring, icon: "⏳", title: "وكالات تنتهي خلال شهر", href: "/clients", linkLabel: "عرض الوكالات", tone: "red" },
    { key: "deadlines", value: counts.deadlinesSoon, icon: "📌", title: "مهل قريبة خلال أسبوع", href: "/calendar", linkLabel: "عرض التقويم", tone: "red" },
    { key: "activations", value: counts.pendingActivations, icon: "📋", title: "تفعيلات معلّقة", href: "/intake?status=fee_agreement_pending", linkLabel: "عرض الطلبات", tone: "amber" },
    { key: "intakes", value: counts.newIntakes, icon: "📥", title: "طلبات استلام جديدة", href: "/intake", linkLabel: "عرض الاستلام", tone: "amber" },
  ];
  return items.filter((i) => i.value > 0);
}

/** المستوى الثالث — مؤشر هادئ في الشريط المضغوط (يظهر ولو كان صفرًا). */
type OtherItem = { label: string; value: number; money?: boolean; href?: string };

function otherItems(roleData: RoleData): OtherItem[] {
  switch (roleData.role) {
    case "lawyer": {
      const d = roleData.d;
      return [
        { label: "مهام متأخرة", value: d.needsDecision.overdueTasks, href: "/tasks?status=overdue" },
        { label: "مهام اليوم", value: d.alerts.tasksDueToday, href: "/tasks" },
        { label: "مذكرات بانتظار مراجعتك", value: d.alerts.memosAwaitingReview, href: "/memos?status=submitted" },
        { label: "مذكرات تعديلات", value: d.needsDecision.memosChangesRequested, href: "/memos" },
        { label: "خدمات مراجعة", value: d.needsDecision.servicesUnderReview, href: "/services?status=under_review" },
      ];
    }
    case "researcher": {
      const d = roleData.d;
      return [
        { label: "قيد الكتابة", value: d.drafts.length, href: "/memos" },
        { label: "تعديلات مطلوبة", value: d.changesRequested.length, href: "/memos" },
        { label: "معتمدة هذا الأسبوع", value: d.approvedThisWeek, href: "/memos" },
      ];
    }
    case "admin": {
      const d = roleData.d;
      return [
        { label: "إيرادات الشهر", value: d.finance.paidThisMonth, money: true },
        { label: "فواتير مستحقة", value: d.finance.dueTotal, money: true, href: "/invoices" },
        { label: "طلبات إغلاق", value: d.overview.pendingClosures, href: "/cases?status=pending_closure" },
        { label: "خدمات متأخرة", value: d.health.overdueServices, href: "/services" },
        { label: "مهل تسوية", value: d.health.settlementSoon, href: "/cases" },
        { label: "تعارض مؤكد", value: d.overview.confirmedConflicts, href: "/intake" },
      ];
    }
    case "secretary": {
      const d = roleData.d;
      return [
        { label: "طلبات استلام اليوم", value: d.todayIntakes, href: "/intake" },
        { label: "جلسات هذا الأسبوع", value: d.weekSessionsCount, href: "/sessions" },
      ];
    }
    case "accountant": {
      const d = roleData.d;
      return [
        { label: "فواتير مستحقة", value: d.dueTotal, money: true, href: "/invoices" },
        { label: "فواتير متأخرة", value: d.overdueTotal, money: true, href: "/invoices" },
        { label: "تحصيلات الشهر", value: d.paidThisMonth, money: true },
        { label: "مصاريف الشهر", value: d.expensesThisMonth, money: true },
        { label: "إيرادات الخدمات", value: d.serviceRevenue, money: true },
      ];
    }
  }
}

function IndicatorBar({ counts, roleData }: { counts: DashboardCounts; roleData: RoleData }) {
  const attention = attentionItems(counts);
  const others = otherItems(roleData);

  return (
    <div className="space-y-5">
      {/* ── المستوى الأول: يحتاج انتباهك ── */}
      {attention.length > 0 ? (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-navy">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            يحتاج انتباهك
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {attention.map((it) => (
              <AttentionCard key={it.key} item={it} />
            ))}
          </div>
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <span>✓</span> لا يوجد ما يحتاج انتباهك العاجل
        </div>
      )}

      {/* ── المستوى الثاني: نظرة عامة ── */}
      <section>
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-navy">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          نظرة عامة
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <OverviewCard icon="⚖️" label="القضايا النشطة" value={counts.activeCases} href="/cases" />
          <OverviewCard icon="👤" label="العملاء" value={counts.clients} href="/clients" />
          <OverviewCard icon="✅" label="قضايا تحتاج إجرائي" value={counts.needsMyAction} href="/tasks" />
        </div>
      </section>

      {/* ── المستوى الثالث: مؤشرات أخرى ── */}
      {others.length > 0 && <OtherBar items={others} />}
    </div>
  );
}

/** بطاقة حرجة (المستوى الأول): أيقونة + رقم كبير + وصف + رابط إجراء. */
function AttentionCard({ item }: { item: AttentionItem }) {
  const t = ATTENTION_TONES[item.tone];
  return (
    <Link
      href={item.href}
      className={`group flex min-h-[130px] flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${t.box}`}
    >
      <div className="flex items-start justify-between">
        <span className={`font-amiri text-[34px] font-bold leading-none ${t.num}`}>
          {toEnglishDigits(item.value)}
        </span>
        <span className="text-xl">{item.icon}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-navy">{item.title}</p>
        <span className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${t.link} group-hover:gap-1.5`}>
          {item.linkLabel} <span aria-hidden>←</span>
        </span>
      </div>
    </Link>
  );
}

/** بطاقة نظرة عامة (المستوى الثاني): أيقونة في مربع رمادي + رقم navy + وصف. */
function OverviewCard({ icon, label, value, href }: { icon: string; label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition-colors hover:bg-navy/[0.02]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-xl">
        {icon}
      </span>
      <div>
        <p className="font-amiri text-2xl font-bold leading-none text-navy">{toEnglishDigits(value)}</p>
        <p className="mt-1 text-xs text-foreground/55">{label}</p>
      </div>
    </Link>
  );
}

/** الشريط الهادئ (المستوى الثالث): مؤشرات مضغوطة مفصولة، الأصفار تظهر بهدوء. */
function OtherBar({ items }: { items: OtherItem[] }) {
  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-[13px] shadow-sm">
      {items.map((it, i) => {
        const inner = (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-slate-500">{it.label}</span>
            <span className="font-semibold text-slate-600">
              {it.money ? formatCurrency(it.value) : toEnglishDigits(it.value)}
            </span>
          </span>
        );
        return (
          <span key={it.label} className="inline-flex items-center gap-x-5">
            {i > 0 && <span className="text-black/10" aria-hidden>·</span>}
            {it.href ? (
              <Link href={it.href} className="transition-opacity hover:opacity-70">{inner}</Link>
            ) : (
              inner
            )}
          </span>
        );
      })}
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
