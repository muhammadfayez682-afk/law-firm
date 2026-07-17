import type { CaseStatus, SettlementPlatform } from "@prisma/client";

/**
 * منطق تحديد "رقم القضية المعروض".
 *
 * القاعدة: الرقم الرسمي من المحكمة له الأولوية دائمًا، ثم رقم منصة التسوية
 * (قوى/تراضي) إن وُجد، وإلا الرقم الداخلي للمكتب كخيار احتياطي.
 *
 * هذا الملف نقيّ (بلا Prisma/خادم) ليُستورد في مكوّنات الواجهة أيضًا.
 * حقل `Case.displayNumber` هو التخزين المُحسَّب مسبقًا لنفس هذا المنطق —
 * يُزامَن عند الكتابة عبر `caseNumber.server.ts`.
 */

export type CaseNumberSource = "court" | "qiwa" | "taradhi" | "internal";

export type CaseWithNumbers = {
  internalNumber: string;
  courtCaseNumber?: string | null;
  amicableSettlement?: {
    requestNumber?: string | null;
    platform: SettlementPlatform; // 'qiwa' | 'taradhi'
  } | null;
  status?: CaseStatus;
};

export type PrimaryCaseNumber = {
  number: string;
  source: CaseNumberSource;
  label: string;
};

/** الرقم المفضّل للعرض مع مصدره وتسميته العربية. */
export function getPrimaryCaseNumber(c: CaseWithNumbers): PrimaryCaseNumber {
  // 1. رقم المحكمة الرسمي له الأولوية المطلقة.
  const court = c.courtCaseNumber?.trim();
  if (court) {
    return { number: court, source: "court", label: "رقم المحكمة" };
  }

  // 2. رقم منصة التسوية (قوى/تراضي) إن وُجد.
  const settlementNumber = c.amicableSettlement?.requestNumber?.trim();
  if (settlementNumber) {
    const platform = c.amicableSettlement!.platform;
    return {
      number: settlementNumber,
      source: platform, // "qiwa" | "taradhi"
      label: platform === "qiwa" ? "رقم قوى" : "رقم تراضي",
    };
  }

  // 3. الرقم الداخلي (خيار احتياطي).
  return { number: c.internalNumber, source: "internal", label: "الرقم الداخلي" };
}

/** القيمة النصية للرقم المفضّل — تُخزَّن في `Case.displayNumber`. */
export function computeDisplayNumber(c: CaseWithNumbers): string {
  return getPrimaryCaseNumber(c).number;
}

export type CaseNumberEntry = {
  label: string;
  value: string;
  primary?: boolean;
  secondary?: boolean;
};

/** كل الأرقام المتوفرة للقضية (للعرض التفصيلي). */
export function getAllCaseNumbers(c: CaseWithNumbers): CaseNumberEntry[] {
  const nums: CaseNumberEntry[] = [];

  const court = c.courtCaseNumber?.trim();
  if (court) {
    nums.push({ label: "رقم المحكمة", value: court, primary: true });
  }

  const settlementNumber = c.amicableSettlement?.requestNumber?.trim();
  if (settlementNumber) {
    const label = c.amicableSettlement!.platform === "qiwa" ? "رقم قوى" : "رقم تراضي";
    nums.push({ label, value: settlementNumber, primary: nums.length === 0 });
  }

  nums.push({
    label: "الرقم الداخلي",
    value: c.internalNumber,
    secondary: nums.length > 0,
  });

  return nums;
}
