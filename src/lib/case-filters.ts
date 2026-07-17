import type { CaseStatus, CaseType, Prisma } from "@prisma/client";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";

export const CASES_PAGE_SIZE = 10;

export type CaseFilters = {
  q?: string | null;
  status?: string | null;
  caseType?: string | null;
  lawyerId?: string | null;
};

export function buildCasesWhere(user: SessionUser, filters: CaseFilters): Prisma.CaseWhereInput {
  const { q, status, caseType, lawyerId } = filters;

  return {
    ...caseVisibilityWhere(user),
    ...(status ? { status: status as CaseStatus } : {}),
    ...(caseType ? { caseType: caseType as CaseType } : {}),
    ...(lawyerId ? { responsibleLawyerId: lawyerId } : {}),
    ...(q
      ? {
          // البحث بأي رقم يعرفه المحامي: الداخلي، رقم المحكمة، أو رقم قوى/تراضي.
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { internalNumber: { contains: q, mode: "insensitive" as const } },
            { courtCaseNumber: { contains: q, mode: "insensitive" as const } },
            { amicableSettlement: { requestNumber: { contains: q, mode: "insensitive" as const } } },
            { client: { fullName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}
