import { prisma } from "@/lib/prisma";
import { CASE_HANDLER_ROLES } from "@/lib/rbac";
import { CASE_OUTCOME_LABELS_AR, isWinningOutcome } from "@/lib/caseClosure";

function getMonthRange(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function getReportsStats() {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now);

  const [
    closedThisMonth,
    closedCasesCount,
    outcomeCounts,
    settledAmicablyCount,
    dueInvoices,
    caseTypeCounts,
    totalCases,
    lawyers,
  ] = await Promise.all([
    prisma.case.count({
      where: { status: "closed", closedDate: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.case.count({ where: { status: "closed" } }),
    prisma.case.groupBy({
      by: ["outcome"],
      _count: true,
      where: { status: "closed", outcome: { not: null } },
    }),
    prisma.case.count({ where: { status: "settled_amicably" } }),
    prisma.invoice.aggregate({
      where: { status: { in: ["due", "overdue"] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.case.groupBy({ by: ["caseType"], _count: true }),
    prisma.case.count(),
    prisma.user.findMany({
      where: { role: { in: CASE_HANDLER_ROLES } },
      orderBy: { fullName: "asc" },
    }),
  ]);

  // معدل الكسب = (كسب كامل + كسب جزئي) ÷ إجمالي القضايا المغلقة × 100.
  const won = outcomeCounts
    .filter((o) => o.outcome && isWinningOutcome(o.outcome))
    .reduce((sum, o) => sum + o._count, 0);
  const winRate = closedCasesCount > 0 ? Math.round((won / closedCasesCount) * 100) : null;

  const outcomeDistribution = outcomeCounts
    .filter((o): o is typeof o & { outcome: NonNullable<typeof o.outcome> } => o.outcome !== null)
    .map((o) => ({
      outcome: o.outcome,
      label: CASE_OUTCOME_LABELS_AR[o.outcome],
      count: o._count,
      percentage: closedCasesCount > 0 ? Math.round((o._count / closedCasesCount) * 100) : 0,
    }));

  const settledCount = outcomeCounts.find((o) => o.outcome === "settled")?._count ?? 0;

  const caseTypeDistribution = caseTypeCounts.map((c) => ({
    caseType: c.caseType,
    count: c._count,
    percentage: totalCases > 0 ? Math.round((c._count / totalCases) * 100) : 0,
  }));

  const lawyerPerformance = await Promise.all(
    lawyers.map(async (lawyer) => {
      const [activeCases, sessionsThisMonth, lawyerClosedCount, lawyerOutcomes] = await Promise.all([
        prisma.case.count({
          where: {
            responsibleLawyerId: lawyer.id,
            status: { notIn: ["closed", "archived"] },
          },
        }),
        prisma.session.count({
          where: {
            case: { responsibleLawyerId: lawyer.id },
            sessionDate: { gte: monthStart, lte: monthEnd },
          },
        }),
        prisma.case.count({ where: { responsibleLawyerId: lawyer.id, status: "closed" } }),
        prisma.case.groupBy({
          by: ["outcome"],
          _count: true,
          where: { responsibleLawyerId: lawyer.id, status: "closed", outcome: { not: null } },
        }),
      ]);

      const lawyerWon = lawyerOutcomes
        .filter((o) => o.outcome && isWinningOutcome(o.outcome))
        .reduce((sum, o) => sum + o._count, 0);
      const lawyerWinRate =
        lawyerClosedCount > 0 ? Math.round((lawyerWon / lawyerClosedCount) * 100) : null;

      return {
        lawyerId: lawyer.id,
        lawyerName: lawyer.fullName,
        activeCases,
        sessionsThisMonth,
        winRate: lawyerWinRate,
      };
    })
  );

  return {
    closedThisMonth,
    closedCasesCount,
    winRate,
    outcomeDistribution,
    settledCount,
    settledAmicablyCount,
    dueInvoicesTotal: Number(dueInvoices._sum.amount ?? 0),
    dueInvoicesCount: dueInvoices._count,
    caseTypeDistribution,
    lawyerPerformance,
  };
}

export type ReportsStats = Awaited<ReturnType<typeof getReportsStats>>;
