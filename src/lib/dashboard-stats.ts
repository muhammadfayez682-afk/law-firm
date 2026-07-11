import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";

const CLOSED_STATUSES = ["closed", "archived"] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const SESSION_TYPE_LABELS_AR: Record<string, string> = {
  negotiation_meeting: "جلسة تسوية ودية",
  hearing: "جلسة محكمة",
  initial_listening: "استماع أولي",
  verdict: "نطق بالحكم",
  arbitration: "تحكيم",
};

/** نهاية أسبوع العمل السعودي (السبت نهاية اليوم). */
function getWeekEnd(now: Date): Date {
  const end = new Date(now);
  const daysUntilSaturday = 6 - now.getDay();
  end.setDate(end.getDate() + daysUntilSaturday);
  end.setHours(23, 59, 59, 999);
  return end;
}

export async function getAlertsCount(user: SessionUser): Promise<number> {
  const now = new Date();
  const caseWhere = caseVisibilityWhere(user);

  const [overdueSessions, qiwaSettlementCases] = await Promise.all([
    prisma.session.count({
      where: { case: caseWhere, sessionDate: { lt: now }, status: "scheduled" },
    }),
    prisma.case.count({
      where: { ...caseWhere, status: "amicable_settlement", caseType: "labor" },
    }),
  ]);

  return overdueSessions + qiwaSettlementCases;
}

export async function getDashboardStats(user: SessionUser) {
  const now = new Date();
  const weekEnd = getWeekEnd(now);
  const caseWhere = caseVisibilityWhere(user);

  const [
    activeCases,
    weekSessions,
    qiwaSettlementCases,
    overdueSessions,
    recentCasesRaw,
    upcomingSessionsRaw,
    qiwaCasesForAlerts,
  ] = await Promise.all([
    prisma.case.count({
      where: { ...caseWhere, status: { notIn: [...CLOSED_STATUSES] } },
    }),
    prisma.session.count({
      where: { case: caseWhere, sessionDate: { gte: now, lte: weekEnd } },
    }),
    prisma.case.count({
      where: { ...caseWhere, status: "amicable_settlement", caseType: "labor" },
    }),
    prisma.session.count({
      where: { case: caseWhere, sessionDate: { lt: now }, status: "scheduled" },
    }),
    prisma.case.findMany({
      where: caseWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        client: true,
        sessions: { where: { sessionDate: { lt: now }, status: "scheduled" }, take: 1 },
      },
    }),
    prisma.session.findMany({
      where: { case: caseWhere, sessionDate: { gte: now } },
      orderBy: { sessionDate: "asc" },
      take: 3,
      include: { case: true },
    }),
    prisma.case.findMany({
      where: { ...caseWhere, status: "amicable_settlement", caseType: "labor" },
      include: { client: true, amicableSettlement: true },
    }),
  ]);

  const recentCases = recentCasesRaw.map((c) => ({
    id: c.id,
    internalNumber: c.internalNumber,
    title: c.title,
    caseType: c.caseType,
    caseTypeLabel: CASE_TYPE_LABELS_AR[c.caseType] ?? c.caseType,
    status: c.status,
    clientName: c.client.fullName,
    isOverdue: c.sessions.length > 0,
  }));

  const upcomingSessions = upcomingSessionsRaw.map((s) => ({
    id: s.id,
    sessionDate: s.sessionDate.toISOString(),
    sessionType: s.sessionType,
    sessionTypeLabel: SESSION_TYPE_LABELS_AR[s.sessionType] ?? s.sessionType,
    isTaradhi: s.sessionType === "negotiation_meeting",
    caseId: s.caseId,
    caseTitle: s.case.title,
  }));

  // تنبيهات المهلة الإلزامية عبر منصة قوى (عمالي فقط) — تراضي اختيارية وليس لها مهلة نظامية.
  const qiwaAlerts = qiwaCasesForAlerts
    .map((c) => {
      const deadline = c.amicableSettlement?.deadlineDate;
      if (!deadline) return null;
      const daysLeft = Math.ceil((new Date(deadline).getTime() - now.getTime()) / MS_PER_DAY);
      return { clientName: c.client.fullName, daysLeft, caseId: c.id };
    })
    .filter((a): a is { clientName: string; daysLeft: number; caseId: string } => a !== null);

  return {
    activeCases,
    weekSessions,
    qiwaSettlementCases,
    overdueSessions,
    recentCases,
    upcomingSessions,
    qiwaAlerts,
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
