import { getServerSession } from "next-auth/next";
import type { Prisma, SessionStatus, SessionType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CASE_HANDLER_ROLES, caseVisibilityWhere } from "@/lib/rbac";
import { SessionsToolbar } from "./SessionsToolbar";
import { SessionsTable } from "./SessionsTable";

type SearchParams = {
  q?: string;
  type?: string;
  status?: string;
  period?: string;
  lawyerId?: string;
};

function getPeriodRange(period: string | undefined): { gte?: Date; lte?: Date } | null {
  if (!period || period === "all") return null;
  const now = new Date();

  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // الأحد بداية الأسبوع
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  return null;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;
  const periodRange = getPeriodRange(params.period);

  // كل شروط العلاقة case (الرؤية + المحامي + البحث) تُدمج في كائن واحد.
  const caseWhere: Prisma.CaseWhereInput = {
    ...caseVisibilityWhere(session.user),
    ...(params.lawyerId ? { responsibleLawyerId: params.lawyerId } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { internalNumber: { contains: params.q, mode: "insensitive" } },
            { client: { fullName: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const where: Prisma.SessionWhereInput = {
    case: caseWhere,
    ...(params.type ? { sessionType: params.type as SessionType } : {}),
    ...(params.status ? { status: params.status as SessionStatus } : {}),
    ...(periodRange ? { sessionDate: periodRange } : {}),
  };

  const [sessions, lawyers] = await Promise.all([
    prisma.session.findMany({
      where,
      orderBy: { sessionDate: "desc" },
      include: {
        case: { include: { client: true, responsibleLawyer: true } },
        minutes: { select: { id: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: CASE_HANDLER_ROLES }, isActive: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const rows = sessions.map((s) => ({
    id: s.id,
    sessionDate: s.sessionDate.toISOString(),
    sessionType: s.sessionType,
    status: s.status,
    court: s.court,
    hasMinutes: s.minutes !== null,
    caseId: s.caseId,
    caseTitle: s.case.title,
    caseInternalNumber: s.case.internalNumber,
    clientName: s.case.client.fullName,
    lawyerName: s.case.responsibleLawyer.fullName,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">الجلسات</h1>
        <p className="text-sm text-foreground/60">{rows.length} جلسة</p>
      </div>

      <SessionsToolbar lawyers={lawyers.map((l) => ({ id: l.id, fullName: l.fullName }))} />

      <SessionsTable rows={rows} />
    </div>
  );
}
