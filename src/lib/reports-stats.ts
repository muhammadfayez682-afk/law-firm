import { prisma } from "@/lib/prisma";

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
    prisma.case.groupBy({ by: ["outcome"], _count: true, where: { outcome: { not: null } } }),
    prisma.case.count({ where: { status: "settled_amicably" } }),
    prisma.invoice.aggregate({
      where: { status: { in: ["due", "overdue"] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.case.groupBy({ by: ["caseType"], _count: true }),
    prisma.case.count(),
    prisma.user.findMany({
      where: { role: { in: ["partner", "senior_lawyer", "lawyer"] } },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const won = outcomeCounts.find((o) => o.outcome === "won")?._count ?? 0;
  const totalWithOutcome = outcomeCounts.reduce((sum, o) => sum + o._count, 0);
  const winRate = totalWithOutcome > 0 ? Math.round((won / totalWithOutcome) * 100) : null;

  const caseTypeDistribution = caseTypeCounts.map((c) => ({
    caseType: c.caseType,
    count: c._count,
    percentage: totalCases > 0 ? Math.round((c._count / totalCases) * 100) : 0,
  }));

  const lawyerPerformance = await Promise.all(
    lawyers.map(async (lawyer) => {
      const [activeCases, sessionsThisMonth, lawyerOutcomes] = await Promise.all([
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
        prisma.case.groupBy({
          by: ["outcome"],
          _count: true,
          where: { responsibleLawyerId: lawyer.id, outcome: { not: null } },
        }),
      ]);

      const lawyerWon = lawyerOutcomes.find((o) => o.outcome === "won")?._count ?? 0;
      const lawyerTotal = lawyerOutcomes.reduce((sum, o) => sum + o._count, 0);
      const lawyerWinRate = lawyerTotal > 0 ? Math.round((lawyerWon / lawyerTotal) * 100) : null;

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
    winRate,
    settledAmicablyCount,
    dueInvoicesTotal: Number(dueInvoices._sum.amount ?? 0),
    dueInvoicesCount: dueInvoices._count,
    caseTypeDistribution,
    lawyerPerformance,
  };
}

export type ReportsStats = Awaited<ReturnType<typeof getReportsStats>>;
