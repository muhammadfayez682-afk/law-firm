import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  getAccountantDashboard,
  getAdminDashboard,
  getLawyerDashboard,
  getResearcherDashboard,
  getSecretaryDashboard,
} from "@/lib/dashboard-role";
import type { SessionUser } from "@/lib/rbac";
import { formatDualDate, formatTime, getDayNameAr } from "@/lib/dateUtils";
import { toEnglishDigits, formatCurrency } from "@/lib/formatNumber";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { SERVICE_STATUS_LABELS_AR, SERVICE_STATUS_STYLES } from "@/lib/services";
import { TASK_PRIORITY_STYLES, TASK_PRIORITY_LABELS_AR } from "@/lib/tasks";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = session.user.role;

  return (
    <div className="space-y-8">
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

      {role === "lawyer" && <LawyerView user={session.user} />}
      {role === "researcher" && <ResearcherView user={session.user} />}
      {(role === "system_admin" || role === "supervisor") && <AdminView />}
      {role === "secretary" && <SecretaryView />}
      {role === "accountant" && <AccountantView />}
    </div>
  );
}

/* ═══════════ المحامي ═══════════ */
async function LawyerView({ user }: { user: SessionUser }) {
  const d = await getLawyerDashboard(user);
  const hasAlerts = d.alerts.todaySessions.length > 0 || d.alerts.tasksDueToday > 0 || d.alerts.memosAwaitingReview > 0;

  return (
    <>
      {/* 1) تنبيهات اليوم */}
      {hasAlerts && (
        <section className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
          <h2 className="mb-3 font-semibold text-red-800">🔔 تنبيهات اليوم</h2>
          <div className="space-y-2">
            {d.alerts.todaySessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-4 py-2.5 text-sm">
                <Link href={`/cases/${s.caseId}`} className="font-medium text-navy hover:underline">{s.caseTitle}</Link>
                <span className="text-foreground/60">{formatTime(s.sessionDate)}</span>
                {s.meetingLink && (
                  <a href={s.meetingLink} target="_blank" rel="noopener noreferrer" className="animate-pulse rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    🔗 فتح الرابط
                  </a>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-3 text-sm">
              {d.alerts.tasksDueToday > 0 && (
                <Link href="/tasks" className="rounded-lg bg-white/80 px-4 py-2 font-medium text-red-800 hover:bg-white">
                  مهام مستحقة اليوم: {toEnglishDigits(d.alerts.tasksDueToday)}
                </Link>
              )}
              {d.alerts.memosAwaitingReview > 0 && (
                <Link href="/memos?status=submitted" className="rounded-lg bg-white/80 px-4 py-2 font-semibold text-red-800 hover:bg-white">
                  📋 مذكرات بانتظار مراجعتك: {toEnglishDigits(d.alerts.memosAwaitingReview)}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2) يحتاج قرارًا منك */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="مهام متأخرة" value={d.needsDecision.overdueTasks} href="/tasks?status=overdue" tone="orange" />
        <StatCard label="مذكرات طُلبت لها تعديلات" value={d.needsDecision.memosChangesRequested} href="/memos" tone="orange" />
        <StatCard label="خدمات قيد المراجعة" value={d.needsDecision.servicesUnderReview} href="/services?status=under_review" tone="orange" />
      </section>

      {/* 3) جلسات هذا الأسبوع مع تقدّم التحضير */}
      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-navy">جلسات هذا الأسبوع</h2>
        {d.weekSessions.length === 0 ? (
          <p className="text-sm text-foreground/50">لا توجد جلسات هذا الأسبوع</p>
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

      {/* 4) قضاياي وخدماتي */}
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

      {/* 5) إحصائيات سريعة */}
      <p className="rounded-xl border border-black/5 bg-white px-5 py-3 text-sm text-foreground/70 shadow-sm">
        قضاياي: <b className="text-navy">{toEnglishDigits(d.stats.myCasesCount)}</b> · خدماتي:{" "}
        <b className="text-navy">{toEnglishDigits(d.stats.myServicesCount)}</b> · مذكرات هذا الشهر:{" "}
        <b className="text-navy">{toEnglishDigits(d.stats.memosThisMonth)}</b>
      </p>
    </>
  );
}

/* ═══════════ الباحث ═══════════ */
async function ResearcherView({ user }: { user: SessionUser }) {
  const d = await getResearcherDashboard(user);
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="مذكرات قيد الكتابة" value={d.drafts.length} href="/memos" tone="navy" />
        <StatCard label="طُلبت لها تعديلات" value={d.changesRequested.length} href="/memos" tone="orange" />
        <StatCard label="معتمدة هذا الأسبوع" value={d.approvedThisWeek} href="/memos" tone="emerald" />
      </section>

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

      <ListCard title="مهام مسندة إليّ" href="/tasks">
        {d.myTasks.map((t) => (
          <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-navy/5">
            <span className="min-w-0">
              <span className="block truncate font-medium text-navy">{t.title}</span>
              <span className="block text-xs text-foreground/50" dir="ltr">{t.taskNumber}</span>
            </span>
            <span className="flex items-center gap-2">
              {t.dueDate && <span className="text-xs text-foreground/50">{formatDualDate(t.dueDate)}</span>}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TASK_PRIORITY_STYLES[t.priority]}`}>
                {TASK_PRIORITY_LABELS_AR[t.priority]}
              </span>
            </span>
          </Link>
        ))}
        {d.myTasks.length === 0 && <p className="px-4 py-6 text-center text-sm text-foreground/50">لا توجد مهام</p>}
      </ListCard>

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
    </>
  );
}

/* ═══════════ مسؤول النظام / المشرف ═══════════ */
async function AdminView() {
  const d = await getAdminDashboard();
  return (
    <>
      <section>
        <h2 className="mb-3 font-semibold text-navy">نظرة عامة</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="طلبات استلام جديدة" value={d.overview.newIntakes} href="/intake" tone="navy" />
          <StatCard label="⚠️ تعارض مصالح مؤكد" value={d.overview.confirmedConflicts} href="/intake" tone="red" />
          <StatCard label="طلبات إغلاق بانتظارك" value={d.overview.pendingClosures} href="/cases?status=pending_closure" tone="amber" />
          <StatCard label="تفعيلات معلّقة" value={d.overview.pendingActivations} href="/intake?status=fee_agreement_pending" tone="navy" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-navy">صحة النظام</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="قضايا متأخرة الوكالة (+14 يوم)" value={d.health.agencyOverdue} href="/cases?status=pending_agency" tone="red" />
          <StatCard label="مهل تسوية خلال أسبوع" value={d.health.settlementSoon} href="/cases" tone="amber" />
          <StatCard label="وكالات تنتهي خلال شهر" value={d.health.agenciesExpiring} href="/reports" tone="orange" />
          <StatCard label="خدمات متأخرة" value={d.health.overdueServices} href="/services" tone="red" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-navy">إحصائيات مالية</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MoneyCard label="فواتير مستحقة" value={d.finance.dueTotal} hint={`${toEnglishDigits(d.finance.dueCount)} فاتورة`} />
          <MoneyCard label="تحصيلات هذا الشهر" value={d.finance.paidThisMonth} />
          <MoneyCard label="إيرادات الخدمات (مكتملة)" value={d.finance.serviceRevenue} />
        </div>
      </section>
    </>
  );
}

/* ═══════════ السكرتارية ═══════════ */
async function SecretaryView() {
  const d = await getSecretaryDashboard();
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="طلبات استلام اليوم" value={d.todayIntakes} href="/intake" tone="navy" />
        <StatCard label="جلسات هذا الأسبوع" value={d.weekSessionsCount} href="/sessions" tone="gold" />
      </section>

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
    </>
  );
}

/* ═══════════ المحاسب ═══════════ */
async function AccountantView() {
  const d = await getAccountantDashboard();
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyCard label="فواتير مستحقة" value={d.dueTotal} hint={`${toEnglishDigits(d.dueCount)} فاتورة`} />
        <MoneyCard label="فواتير متأخرة" value={d.overdueTotal} hint={`${toEnglishDigits(d.overdueCount)} فاتورة`} tone="red" />
        <MoneyCard label="تحصيلات هذا الشهر" value={d.paidThisMonth} hint={`${toEnglishDigits(d.paidCount)} فاتورة`} />
        <MoneyCard label="مصاريف هذا الشهر" value={d.expensesThisMonth} />
      </section>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyCard label="إيرادات الخدمات القانونية (مكتملة)" value={d.serviceRevenue} />
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm text-foreground/50">روابط سريعة</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/invoices" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">الفواتير والمصاريف</Link>
            <Link href="/services" className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5">الخدمات</Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ═══════════ مكوّنات مشتركة ═══════════ */
const TONES: Record<string, string> = {
  navy: "border-r-navy",
  red: "border-r-red-500 bg-red-50",
  amber: "border-r-amber-500 bg-amber-50",
  orange: "border-r-orange-500 bg-orange-50",
  emerald: "border-r-emerald-500",
  gold: "border-r-gold",
};

function StatCard({ label, value, href, tone = "navy" }: { label: string; value: number; href?: string; tone?: string }) {
  const inner = (
    <div className={`rounded-xl border border-black/5 border-r-4 ${TONES[tone] ?? TONES.navy} bg-white p-5 shadow-sm transition-colors hover:bg-navy/5`}>
      <p className="text-sm text-foreground/60">{label}</p>
      <p className="mt-2 font-amiri text-2xl font-bold text-navy">{toEnglishDigits(value)}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function MoneyCard({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: string }) {
  return (
    <div className={`rounded-xl border border-black/5 border-r-4 ${tone === "red" ? "border-r-red-500" : "border-r-gold"} bg-white p-5 shadow-sm`}>
      <p className="text-sm text-foreground/60">{label}</p>
      <p className="mt-2 font-amiri text-xl font-bold text-navy">{formatCurrency(value)}</p>
      {hint && <p className="mt-1 text-xs text-gold">{hint}</p>}
    </div>
  );
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
