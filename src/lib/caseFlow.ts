import type { AmicableSettlement, CaseFlowStage, CaseType, SettlementPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * أي أنواع القضايا تُتابَع عبر AmicableSettlement (قوى/تراضي) وأيّ منصة تخصّها.
 * هذا الربط ثابت لأن enum SettlementPlatform ذو قيمتين فقط (qiwa/taradhi)، على
 * خلاف بقية تفاصيل المرحلة (الاسم، الإلزامية، الجهة، الرابط) المُدارة عبر CaseFlowStage
 * القابل للتعديل من واجهة الإعدادات.
 */
const AMICABLE_SETTLEMENT_PLATFORM: Partial<Record<CaseType, SettlementPlatform>> = {
  labor: "qiwa",
  general: "taradhi",
  commercial: "taradhi",
  personal_status: "taradhi",
  debt_collection: "taradhi",
};

/** المهلة النظامية لتسوية قوى (21 يومًا) — حقيقة قانونية ثابتة، غير قابلة للتعديل عبر الإعدادات. */
const QIWA_DEADLINE_DAYS = 21;

export function getAmicableSettlementPlatform(caseType: CaseType): SettlementPlatform | null {
  return AMICABLE_SETTLEMENT_PLATFORM[caseType] ?? null;
}

export function computeDeadlineDate(caseType: CaseType, from: Date = new Date()): Date | null {
  if (AMICABLE_SETTLEMENT_PLATFORM[caseType] !== "qiwa") return null;
  const deadline = new Date(from);
  deadline.setDate(deadline.getDate() + QIWA_DEADLINE_DAYS);
  return deadline;
}

/** كل مراحل المسار لنوع قضية معيّن، مرتّبة، مع استبعاد المراحل المعطّلة. */
export async function getCaseFlowStages(caseType: CaseType): Promise<CaseFlowStage[]> {
  return prisma.caseFlowStage.findMany({
    where: { caseType, active: true },
    orderBy: { order: "asc" },
  });
}

/** أول مرحلة في المسار (عادة مرحلة التسوية/التظلم قبل المحكمة). */
export async function getFirstStage(caseType: CaseType): Promise<CaseFlowStage | null> {
  return prisma.caseFlowStage.findFirst({
    where: { caseType, order: 1, active: true },
  });
}

export async function canProceedToCourt(
  caseType: CaseType,
  settlement: Pick<AmicableSettlement, "outcome"> | null
): Promise<{ allowed: boolean; reason?: string }> {
  const firstStage = await getFirstStage(caseType);

  if (!firstStage || !firstStage.isMandatory) {
    return { allowed: true };
  }

  if (!settlement || settlement.outcome === "pending") {
    const authoritySuffix = firstStage.authority ? ` عبر ${firstStage.authority}` : "";
    return {
      allowed: false,
      reason: `${firstStage.labelAr}${authoritySuffix} إلزامية قبل رفع الدعوى.`,
    };
  }

  return { allowed: true };
}
