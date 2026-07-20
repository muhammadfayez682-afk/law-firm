import type { CaseStatus, CaseType, Prisma } from "@prisma/client";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";

export const CASES_PAGE_SIZE = 10;

export type CaseView = "active" | "archived" | "deleted";

export type CaseFilters = {
  q?: string | null;
  status?: string | null;
  caseType?: string | null;
  lawyerId?: string | null;
  view?: CaseView | null;
};

export function buildCasesWhere(user: SessionUser, filters: CaseFilters): Prisma.CaseWhereInput {
  const { q, status, caseType, lawyerId, view } = filters;

  // العرض: نشطة (افتراضي، تُستبعد المؤرشفة) | مؤرشفة | محذوفة (مسؤول النظام).
  let viewWhere: Prisma.CaseWhereInput;
  if (view === "archived") {
    viewWhere = { ...caseVisibilityWhere(user), status: "archived" };
  } else if (view === "deleted") {
    // القضايا المحذوفة (حذف ناعم) — لمسؤول النظام؛ نتجاوز deletedAt:null.
    viewWhere = { deletedAt: { not: null } };
  } else {
    // النشطة: كل شيء عدا المؤرشفة (والمحذوفة مُستبعدة أصلًا في caseVisibilityWhere).
    viewWhere = { ...caseVisibilityWhere(user), NOT: { status: "archived" } };
  }

  return {
    ...viewWhere,
    ...(status && view !== "archived" ? { status: status as CaseStatus } : {}),
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
