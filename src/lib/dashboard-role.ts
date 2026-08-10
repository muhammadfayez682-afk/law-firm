import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";
import { serviceVisibilityWhere, SERVICE_ACTIVE_STATUSES } from "@/lib/services";
import { prepProgress, isCriticalPrepTask } from "@/lib/sessionPrep";

const MS_DAY = 24 * 60 * 60 * 1000;

function dayBounds(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + MS_DAY);
  return { start, end };
}
function weekEnd(now: Date) {
  const end = new Date(now);
  end.setDate(end.getDate() + (6 - now.getDay()));
  end.setHours(23, 59, 59, 999);
  return end;
}

/** «مهامي» تشمل المُسند الرئيسي والمُسندين المتعددين. */
function myTasksWhere(userId: string) {
  return { OR: [{ assignedToId: userId }, { assignees: { some: { userId } } }] };
}

export type CriticalDateItem = {
  id: string;
  caseId: string;
  caseTitle: string;
  caseNumber: string;
  kind: "appeal" | "appeal_missing" | "follow_up";
  date: string | null; // ISO أو null (للمهلة غير المسجّلة)
  daysLeft: number | null;
};

// ══════════ تواريخ حرجة (مهل استئناف + متابعات) — مقيّدة بصلاحية المستخدم ══════════
export async function getCriticalDates(user: SessionUser): Promise<CriticalDateItem[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * MS_DAY); // نافذة العرض: 30 يومًا قادمة
  const caseWhere = caseVisibilityWhere(user);

  const cases = await prisma.case.findMany({
    where: {
      ...caseWhere,
      status: { notIn: ["closed", "archived"] },
      OR: [
        { appealDeadline: { not: null, lte: horizon } },
        { followUpDate: { not: null, lte: horizon } },
        { status: "ruled_first_instance", appealDeadline: null },
      ],
    },
    select: {
      id: true,
      title: true,
      internalNumber: true,
      displayNumber: true,
      status: true,
      appealDeadline: true,
      followUpDate: true,
    },
  });

  const items: CriticalDateItem[] = [];
  const daysLeft = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / MS_DAY);
  for (const c of cases) {
    const base = { caseId: c.id, caseTitle: c.title, caseNumber: c.displayNumber ?? c.internalNumber };
    if (c.appealDeadline && c.appealDeadline <= horizon) {
      items.push({ id: `appeal:${c.id}`, ...base, kind: "appeal", date: c.appealDeadline.toISOString(), daysLeft: daysLeft(c.appealDeadline) });
    } else if (c.status === "ruled_first_instance" && !c.appealDeadline) {
      items.push({ id: `appeal_missing:${c.id}`, ...base, kind: "appeal_missing", date: null, daysLeft: null });
    }
    if (c.followUpDate && c.followUpDate <= horizon) {
      items.push({ id: `follow:${c.id}`, ...base, kind: "follow_up", date: c.followUpDate.toISOString(), daysLeft: daysLeft(c.followUpDate) });
    }
  }

  // الترتيب: مهلة غير مسجّلة أولًا (أخطر)، ثم بالأقرب زمنيًا.
  return items.sort((a, b) => {
    const ka = a.daysLeft ?? -Infinity;
    const kb = b.daysLeft ?? -Infinity;
    return ka - kb;
  });
}

const SESSION_TYPE_LABELS_AR: Record<string, string> = {
  negotiation_meeting: "جلسة تسوية ودية",
  hearing: "جلسة محكمة",
  initial_listening: "استماع أولي",
  verdict: "نطق بالحكم",
  arbitration: "تحكيم",
};

export type MyTaskRow = {
  id: string;
  title: string;
  taskNumber: string;
  caseId: string | null;
  caseTitle: string | null;
  dueDate: string | null;
  status: string; // الحالة الفعّالة للمكلّف الحالي (أو حالة المهمة إن لا سجل مكلّف)
  isOverdue: boolean;
  isDueSoon: boolean; // مستحقة خلال يومين ولم تُنجَز
};

// ══════════ مهامي (شخصي — لكل الأدوار) ══════════
export async function getMyTasks(user: SessionUser): Promise<MyTaskRow[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * MS_DAY);

  // النشطة فقط (نستبعد الملغاة والمرفوضة والمنجزة على مستوى المهمة).
  const tasks = await prisma.task.findMany({
    where: {
      ...myTasksWhere(user.id),
      cancelledAt: null,
      status: { notIn: ["cancelled", "rejected", "completed"] },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 12,
    select: {
      id: true,
      title: true,
      taskNumber: true,
      status: true,
      dueDate: true,
      case: { select: { id: true, title: true } },
      // حالة المكلّف الحالي المستقلة (لا حالة المهمة العامة).
      assignees: { where: { userId: user.id }, select: { status: true } },
    },
  });

  return tasks
    .map((t) => {
      // حالة المكلّف المستقلة تتقدّم على حالة المهمة العامة إن وُجد سجل مكلّف.
      const assigneeStatus = t.assignees[0]?.status ?? null;
      const done = assigneeStatus === "completed" || t.status === "completed";
      const effectiveStatus = assigneeStatus ?? t.status;
      const isOverdue = !done && t.dueDate != null && t.dueDate < now;
      const isDueSoon = !done && !isOverdue && t.dueDate != null && t.dueDate <= soon;
      return {
        id: t.id,
        title: t.title,
        taskNumber: t.taskNumber,
        caseId: t.case?.id ?? null,
        caseTitle: t.case?.title ?? null,
        dueDate: t.dueDate?.toISOString() ?? null,
        status: effectiveStatus,
        isOverdue,
        isDueSoon,
      };
    })
    // المتأخرة أولًا، ثم القريبة، ثم البقية — مع الحفاظ على الترتيب الزمني داخل كل مجموعة.
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || Number(b.isDueSoon) - Number(a.isDueSoon));
}

export type MySessionRow = {
  id: string;
  caseId: string;
  caseTitle: string;
  caseNumber: string;
  sessionTypeLabel: string;
  sessionDate: string;
  sessionMode: string;
  meetingLink: string | null;
  court: string | null;
  isToday: boolean;
  isTomorrow: boolean;
};

// ══════════ جلساتي القادمة (شخصي — جلسات قضايا المستخدم) ══════════
export async function getMySessions(user: SessionUser): Promise<MySessionRow[]> {
  const now = new Date();
  const { start: todayStart } = dayBounds(now);
  const todayEnd = new Date(todayStart.getTime() + MS_DAY);
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * MS_DAY);

  const sessions = await prisma.session.findMany({
    where: { case: caseVisibilityWhere(user), sessionDate: { gte: now }, status: "scheduled" },
    orderBy: { sessionDate: "asc" },
    take: 10,
    include: { case: { select: { id: true, title: true, internalNumber: true, displayNumber: true } } },
  });

  return sessions.map((s) => {
    const d = s.sessionDate;
    return {
      id: s.id,
      caseId: s.caseId,
      caseTitle: s.case.title,
      caseNumber: s.case.displayNumber ?? s.case.internalNumber,
      sessionTypeLabel: SESSION_TYPE_LABELS_AR[s.sessionType] ?? s.sessionType,
      sessionDate: d.toISOString(),
      sessionMode: s.sessionMode,
      meetingLink: s.meetingLink,
      court: s.court,
      isToday: d >= todayStart && d < todayEnd,
      isTomorrow: d >= todayEnd && d < tomorrowEnd,
    };
  });
}

// ══════════ المحامي ══════════
export async function getLawyerDashboard(user: SessionUser) {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = dayBounds(now);
  const wEnd = weekEnd(now);
  const caseWhere = caseVisibilityWhere(user);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySessions, tasksDueToday, memosAwaitingReview, overdueTasks, memosChangesRequested, servicesUnderReview, weekSessionsRaw, myCases, myServices, myCasesCount, myServicesCount, memosThisMonth] =
    await Promise.all([
      prisma.session.findMany({
        where: { case: caseWhere, sessionDate: { gte: todayStart, lt: todayEnd }, status: "scheduled" },
        orderBy: { sessionDate: "asc" },
        include: { case: { select: { id: true, title: true, internalNumber: true, displayNumber: true } } },
      }),
      prisma.task.count({ where: { ...myTasksWhere(user.id), status: { in: ["pending", "in_progress"] }, dueDate: { gte: todayStart, lt: todayEnd } } }),
      prisma.legalMemo.count({ where: { status: "submitted", case: caseWhere } }),
      prisma.task.count({ where: { ...myTasksWhere(user.id), status: { in: ["pending", "in_progress"] }, dueDate: { lt: now } } }),
      prisma.legalMemo.count({ where: { status: "changes_requested", case: caseWhere } }),
      prisma.legalService.count({ where: { ...serviceVisibilityWhere(user), status: "under_review" } }),
      prisma.session.findMany({
        where: { case: caseWhere, sessionDate: { gte: now, lte: wEnd }, status: "scheduled" },
        orderBy: { sessionDate: "asc" },
        take: 8,
        include: {
          case: { select: { id: true, title: true, internalNumber: true, displayNumber: true } },
          preparationChecklist: { select: { isCompleted: true, taskType: true } },
        },
      }),
      prisma.case.findMany({
        where: { ...caseWhere, status: { notIn: ["closed", "archived"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          client: { select: { fullName: true } },
          sessions: { where: { sessionDate: { gte: now } }, orderBy: { sessionDate: "asc" }, take: 1, select: { sessionDate: true } },
        },
      }),
      prisma.legalService.findMany({
        where: { ...serviceVisibilityWhere(user), status: { in: SERVICE_ACTIVE_STATUSES } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { client: { select: { fullName: true } } },
      }),
      prisma.case.count({ where: { ...caseWhere, status: { notIn: ["closed", "archived"] } } }),
      prisma.legalService.count({ where: { ...serviceVisibilityWhere(user), status: { in: SERVICE_ACTIVE_STATUSES } } }),
      prisma.legalMemo.count({ where: { case: caseWhere, createdAt: { gte: monthStart } } }),
    ]);

  const weekSessions = weekSessionsRaw.map((s) => ({
    id: s.id,
    caseId: s.caseId,
    caseTitle: s.case.title,
    caseNumber: s.case.displayNumber ?? s.case.internalNumber,
    sessionDate: s.sessionDate.toISOString(),
    sessionMode: s.sessionMode,
    meetingLink: s.meetingLink,
    prepProgress: prepProgress(s.preparationChecklist),
    criticalPending: s.preparationChecklist.filter((t) => !t.isCompleted && isCriticalPrepTask(t.taskType)).length,
  }));

  return {
    alerts: {
      todaySessions: todaySessions.map((s) => ({
        id: s.id,
        caseId: s.caseId,
        caseTitle: s.case.title,
        sessionDate: s.sessionDate.toISOString(),
        sessionMode: s.sessionMode,
        meetingLink: s.meetingLink,
      })),
      tasksDueToday,
      memosAwaitingReview,
    },
    needsDecision: { overdueTasks, memosChangesRequested, servicesUnderReview },
    weekSessions,
    myCases: myCases.map((c) => ({
      id: c.id,
      title: c.title,
      number: c.displayNumber ?? c.internalNumber,
      clientName: c.client.fullName,
      status: c.status,
      nextSession: c.sessions[0]?.sessionDate.toISOString() ?? null,
    })),
    myServices: myServices.map((s) => ({
      id: s.id,
      title: s.title,
      number: s.serviceNumber,
      clientName: s.client.fullName,
      status: s.status,
    })),
    stats: { myCasesCount, myServicesCount, memosThisMonth },
  };
}

// ══════════ الباحث ══════════
export async function getResearcherDashboard(user: SessionUser) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * MS_DAY);
  const caseWhere = caseVisibilityWhere(user);

  const [drafts, changesRequested, approvedThisWeek, myTasks, myCases, myServices] = await Promise.all([
    prisma.legalMemo.findMany({
      where: { authoredById: user.id, status: "draft" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { case: { select: { id: true, internalNumber: true, displayNumber: true } } },
    }),
    prisma.legalMemo.findMany({
      where: { authoredById: user.id, status: "changes_requested" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { case: { select: { id: true, internalNumber: true, displayNumber: true } } },
    }),
    prisma.legalMemo.count({ where: { authoredById: user.id, status: { in: ["approved", "submitted_to_court"] }, updatedAt: { gte: weekAgo } } }),
    prisma.task.findMany({
      where: { ...myTasksWhere(user.id), status: { in: ["pending", "in_progress"] } },
      orderBy: [{ dueDate: "asc" }],
      take: 8,
      select: { id: true, taskNumber: true, title: true, dueDate: true, priority: true },
    }),
    prisma.case.findMany({
      where: { ...caseWhere, status: { notIn: ["closed", "archived"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, internalNumber: true, displayNumber: true },
    }),
    prisma.legalService.findMany({
      where: { ...serviceVisibilityWhere(user), status: { in: SERVICE_ACTIVE_STATUSES } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, serviceNumber: true },
    }),
  ]);

  const memoRow = (m: (typeof drafts)[number]) => ({
    id: m.id,
    title: m.title,
    caseNumber: m.case.displayNumber ?? m.case.internalNumber,
  });

  return {
    drafts: drafts.map(memoRow),
    changesRequested: changesRequested.map(memoRow),
    approvedThisWeek,
    myTasks: myTasks.map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null })),
    myCases: myCases.map((c) => ({ id: c.id, title: c.title, number: c.displayNumber ?? c.internalNumber })),
    myServices: myServices.map((s) => ({ id: s.id, title: s.title, number: s.serviceNumber })),
  };
}

// ══════════ مسؤول النظام ══════════
export async function getAdminDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const in30 = new Date(now.getTime() + 30 * MS_DAY);
  const fourteenAgo = new Date(now.getTime() - 14 * MS_DAY);
  const in7 = new Date(now.getTime() + 7 * MS_DAY);

  const [newIntakes, confirmedConflicts, pendingClosures, pendingActivations, agencyOverdue, settlementSoon, agenciesExpiring, overdueServices, dueInvoices, paidThisMonth, serviceRevenue] =
    await Promise.all([
      prisma.intakeRequest.count({ where: { status: { in: ["received", "conflict_check"] } } }),
      prisma.intakeRequest.count({ where: { conflictResult: "confirmed", status: { notIn: ["accepted", "rejected"] } } }),
      prisma.case.count({ where: { status: "pending_closure" } }),
      prisma.intakeRequest.count({ where: { status: "fee_agreement_pending" } }),
      prisma.case.count({ where: { status: "pending_agency", openDate: { lt: fourteenAgo } } }),
      prisma.amicableSettlement.count({ where: { outcome: "pending", deadlineDate: { not: null, gte: now, lte: in7 } } }),
      prisma.agency.count({ where: { expiryDate: { gte: now, lte: in30 } } }),
      prisma.legalService.count({ where: { status: { in: SERVICE_ACTIVE_STATUSES }, dueDate: { not: null, lt: now } } }),
      prisma.invoice.aggregate({ where: { status: { in: ["due", "overdue"] } }, _sum: { amount: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: "paid", issueDate: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
      prisma.legalService.aggregate({ where: { status: "completed" }, _sum: { fee: true } }),
    ]);

  return {
    overview: { newIntakes, confirmedConflicts, pendingClosures, pendingActivations },
    health: { agencyOverdue, settlementSoon, agenciesExpiring, overdueServices },
    finance: {
      dueTotal: Number(dueInvoices._sum.amount ?? 0),
      dueCount: dueInvoices._count,
      paidThisMonth: Number(paidThisMonth._sum.amount ?? 0),
      serviceRevenue: Number(serviceRevenue._sum.fee ?? 0),
    },
  };
}

// ══════════ السكرتارية ══════════
export async function getSecretaryDashboard() {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = dayBounds(now);
  const wEnd = weekEnd(now);
  const in30 = new Date(now.getTime() + 30 * MS_DAY);

  const [todayIntakes, weekSessions, upcomingSessions, expiringAgencies] = await Promise.all([
    prisma.intakeRequest.count({ where: { receivedAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.session.count({ where: { sessionDate: { gte: now, lte: wEnd }, status: "scheduled" } }),
    prisma.session.findMany({
      where: { sessionDate: { gte: now }, status: "scheduled" },
      orderBy: { sessionDate: "asc" },
      take: 6,
      include: { case: { select: { id: true, title: true, internalNumber: true, displayNumber: true } } },
    }),
    prisma.agency.findMany({
      where: { expiryDate: { gte: now, lte: in30 } },
      orderBy: { expiryDate: "asc" },
      take: 6,
      include: { client: { select: { id: true, fullName: true } } },
    }),
  ]);

  return {
    todayIntakes,
    weekSessionsCount: weekSessions,
    upcomingSessions: upcomingSessions.map((s) => ({
      id: s.id,
      caseId: s.caseId,
      caseTitle: s.case.title,
      caseNumber: s.case.displayNumber ?? s.case.internalNumber,
      sessionDate: s.sessionDate.toISOString(),
      sessionMode: s.sessionMode,
    })),
    expiringAgencies: expiringAgencies.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      clientName: a.client.fullName,
      agencyNumber: a.agencyNumber,
      expiryDate: a.expiryDate.toISOString(),
      daysLeft: Math.ceil((a.expiryDate.getTime() - now.getTime()) / MS_DAY),
    })),
  };
}

// ══════════ المحاسب ══════════
export async function getAccountantDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [due, overdue, paidThisMonth, expensesThisMonth, serviceRevenue] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: "due" }, _sum: { amount: true }, _count: true }),
    prisma.invoice.aggregate({ where: { OR: [{ status: "overdue" }, { status: "due", dueDate: { lt: now } }] }, _sum: { amount: true }, _count: true }),
    prisma.invoice.aggregate({ where: { status: "paid", issueDate: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { expenseDate: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.legalService.aggregate({ where: { status: "completed" }, _sum: { fee: true } }),
  ]);

  return {
    dueTotal: Number(due._sum.amount ?? 0),
    dueCount: due._count,
    overdueTotal: Number(overdue._sum.amount ?? 0),
    overdueCount: overdue._count,
    paidThisMonth: Number(paidThisMonth._sum.amount ?? 0),
    paidCount: paidThisMonth._count,
    expensesThisMonth: Number(expensesThisMonth._sum.amount ?? 0),
    serviceRevenue: Number(serviceRevenue._sum.fee ?? 0),
  };
}
