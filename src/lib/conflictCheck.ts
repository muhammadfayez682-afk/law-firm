import type { CaseStatus, ConflictCheckResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ConflictOutcome = {
  result: ConflictCheckResult;
  details: string;
  clientId?: string;
  pastCaseId?: string;
};

const INACTIVE_STATUSES: CaseStatus[] = ["closed", "archived"];
const ACTIVE_ONLY = { status: { notIn: INACTIVE_STATUSES } };

/**
 * فحص تعارض المصالح الآلي بناءً على اسم الطرف المقابل:
 * 1) هل هو عميل حالي لدينا قضية نشطة معه؟ → تعارض مؤكد
 * 2) هل كان موكّلنا سابقًا في قضية؟ → تعارض مؤكد
 * 3) هل يظهر كطرف مقابل في قضية نشطة؟ → تعارض محتمل
 * وإلا → نظيف.
 */
export async function checkConflictOfInterest(opposingParty: string): Promise<ConflictOutcome> {
  const cleanName = opposingParty.trim();
  if (!cleanName) {
    return { result: "clear", details: "لا يوجد طرف مقابل للفحص" };
  }

  // 1. الطرف المقابل عميل حالي بقضية نشطة.
  const existingClient = await prisma.client.findFirst({
    where: { fullName: { contains: cleanName, mode: "insensitive" } },
    include: { cases: { where: ACTIVE_ONLY } },
  });
  if (existingClient && existingClient.cases.length > 0) {
    return {
      result: "confirmed",
      details: `الطرف المقابل عميل حالي — قضية ${existingClient.cases[0].internalNumber}`,
      clientId: existingClient.id,
    };
  }

  // 2. ظهر كموكّل لنا سابقًا (أي قضية).
  const asOurClientBefore = await prisma.caseParty.findMany({
    where: { name: { contains: cleanName, mode: "insensitive" }, isOurClient: true },
    include: { case: true },
  });
  if (asOurClientBefore.length > 0) {
    return {
      result: "confirmed",
      details: `كان موكّلنا سابقًا في قضية ${asOurClientBefore[0].case.internalNumber}`,
      pastCaseId: asOurClientBefore[0].caseId,
    };
  }

  // 3. يظهر كطرف مقابل في قضية نشطة (احتمال تعارض).
  const asOpposingParty = await prisma.caseParty.findMany({
    where: {
      name: { contains: cleanName, mode: "insensitive" },
      isOurClient: false,
      case: ACTIVE_ONLY,
    },
    include: { case: true },
  });
  if (asOpposingParty.length > 0) {
    return {
      result: "potential",
      details: `ظهر كطرف مقابل في قضية نشطة ${asOpposingParty[0].case.internalNumber}`,
    };
  }

  return { result: "clear", details: "لا يوجد تعارض مصالح" };
}
