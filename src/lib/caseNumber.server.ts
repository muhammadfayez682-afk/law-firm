import type { Prisma, PrismaClient } from "@prisma/client";
import { computeDisplayNumber } from "./caseNumber";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * يعيد حساب `Case.displayNumber` من الحالة الحالية للقضية (رقم المحكمة ثم
 * رقم منصة التسوية ثم الرقم الداخلي) ويحدّثه إن تغيّر.
 *
 * يُستدعى بعد أي كتابة تمسّ الأرقام: إنشاء القضية، تحديث رقم المحكمة،
 * إضافة/تعديل رقم قوى/تراضي. يقبل عميل Prisma أو عميل معاملة (tx).
 */
export async function syncCaseDisplayNumber(db: Db, caseId: string): Promise<string | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { amicableSettlement: true },
  });
  if (!c) return null;

  const displayNumber = computeDisplayNumber(c);
  if (displayNumber !== c.displayNumber) {
    await db.case.update({ where: { id: caseId }, data: { displayNumber } });
  }
  return displayNumber;
}
