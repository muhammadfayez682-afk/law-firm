// منطق تقرير الجلسة (session_report) والقيد التسلسلي الزمني — يُشترك بين مسارات الحفظ/الجلسات.
import type { Prisma, PrismaClient } from "@prisma/client";
import { toHijri } from "@/lib/dateUtils";
import { notifyBulk } from "@/lib/notifications/send";
import { attendingLawyerIds } from "@/lib/sessionMemo";

export const SESSION_REPORT_KEY = "session_report";

type Db = PrismaClient | Prisma.TransactionClient;

/** الملخص إلزامي: قيمة نصية غير فارغة بعد التشذيب (مسافات فقط لا تُعدّ). */
export function isSessionSummaryFilled(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** «تقرير مكتمل» لجلسة = وجود FilledTemplate(session_report) مرتبط بها بملخص جلسة غير فارغ. */
export function isCompleteSessionReport(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return isSessionSummaryFilled((data as Record<string, unknown>).sessionSummary);
}

export type BlockingSession = { id: string; sessionDate: Date; hijriDate: string | null };

/**
 * أقدم جلسة **منعقدة (held)** في القضية بلا تقرير مكتمل، أسبق زمنيًا من `beforeDate` — أو null.
 * الترتيب بـ sessionDate الفعلي لا ترتيب الإدخال. الجلسات المؤجّلة/غير المنعقدة تُتجاوز تمامًا.
 * - `beforeDate`: يُحصر البحث بالجلسات الأقدم منه (حصريًا). أهمِله لفحص كل الجلسات المنعقدة.
 * - `excludeSessionId`: يُستبعد (الجلسة التي نكتب تقريرها الآن).
 */
export async function findEarliestHeldSessionMissingReport(
  db: Db,
  caseId: string,
  opts: { beforeDate?: Date; excludeSessionId?: string } = {},
): Promise<BlockingSession | null> {
  const heldSessions = await db.session.findMany({
    where: {
      caseId,
      status: "held",
      ...(opts.beforeDate ? { sessionDate: { lt: opts.beforeDate } } : {}),
      ...(opts.excludeSessionId ? { id: { not: opts.excludeSessionId } } : {}),
    },
    orderBy: { sessionDate: "asc" },
    select: { id: true, sessionDate: true, hijriDate: true },
  });
  if (heldSessions.length === 0) return null;

  const reports = await db.filledTemplate.findMany({
    where: { templateKey: SESSION_REPORT_KEY, sessionId: { in: heldSessions.map((s) => s.id) } },
    select: { sessionId: true, data: true },
  });
  const completeSessionIds = new Set(
    reports.filter((r) => isCompleteSessionReport(r.data)).map((r) => r.sessionId),
  );

  return heldSessions.find((s) => !completeSessionIds.has(s.id)) ?? null;
}

function blockerHijri(blocker: BlockingSession): string {
  return blocker.hijriDate ?? toHijri(blocker.sessionDate);
}

/** رسالة حجب كتابة تقرير الجلسة التالية. */
export function reportBlockedMessage(blocker: BlockingSession): string {
  return `يجب إكمال تقرير الجلسة المنعقدة بتاريخ ${blockerHijri(blocker)}هـ قبل كتابة تقرير هذه الجلسة.`;
}

/** رسالة حجب إضافة جلسة جديدة يدويًا. */
export function addSessionBlockedMessage(blocker: BlockingSession): string {
  return `يجب إكمال تقرير الجلسة المنعقدة بتاريخ ${blockerHijri(blocker)}هـ قبل إضافة جلسة جديدة.`;
}

/** تذكير المحامي الحاضر/المسؤول بالجلسة المنعقدة التي تحجب التقدّم (لا يُفشل العملية الأساسية). */
export async function notifySessionReportRequired(
  db: Db,
  caseId: string,
  blocker: BlockingSession,
  triggeredById: string,
): Promise<void> {
  const caseData = await db.case.findUnique({
    where: { id: caseId },
    select: {
      responsibleLawyerId: true,
      displayNumber: true,
      internalNumber: true,
      team: { select: { userId: true, roleInCase: true } },
    },
  });
  if (!caseData) return;
  const recipients = attendingLawyerIds(caseData).filter((uid) => uid !== triggeredById);
  if (recipients.length === 0) return;
  const caseNo = caseData.displayNumber ?? caseData.internalNumber;
  await notifyBulk(recipients, {
    type: "session_report_required",
    priority: "high",
    title: "مطلوب تقرير الجلسة",
    message: `الجلسة المنعقدة بتاريخ ${blockerHijri(blocker)}هـ في القضية ${caseNo} بلا تقرير — أكمِله للمتابعة.`,
    actionUrl: `/cases/${caseId}`,
    resourceType: "session",
    resourceId: blocker.id,
    triggeredById,
  });
}
