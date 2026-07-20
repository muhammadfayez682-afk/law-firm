import { prisma } from "@/lib/prisma";
import { SOFT_DELETE_GRACE_DAYS } from "@/lib/caseArchive";

/**
 * حذف قضية وكل سجلاتها المرتبطة نهائيًا (بترتيب المفاتيح الأجنبية).
 * يُستخدم من شبكة أمان الكرون بعد انقضاء مهلة الحذف الناعم.
 */
export async function purgeCaseCompletely(caseId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // فكّ ارتباط الطلبات (لا نحذف طلبات الاستلام نفسها).
    await tx.intakeRequest.updateMany({ where: { caseId }, data: { caseId: null } });
    await tx.intakeRequest.updateMany({ where: { relatedCaseId: caseId }, data: { relatedCaseId: null } });

    // المهام وتوابعها.
    const taskIds = (await tx.task.findMany({ where: { caseId }, select: { id: true } })).map((t) => t.id);
    if (taskIds.length) {
      await tx.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.taskAssignee.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    }

    // المذكرات (النسخ التكميلية أولًا لفكّ parentMemoId).
    await tx.memoReview.deleteMany({ where: { memo: { caseId } } });
    await tx.legalMemo.deleteMany({ where: { caseId, parentMemoId: { not: null } } });
    await tx.legalMemo.deleteMany({ where: { caseId } });

    // الجلسات وتوابعها.
    const sessionIds = (await tx.session.findMany({ where: { caseId }, select: { id: true } })).map((s) => s.id);
    if (sessionIds.length) {
      await tx.sessionPreparationTask.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.sessionMinutes.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.filledTemplate.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
    }

    // بقية التوابع المباشرة.
    await tx.filledTemplate.deleteMany({ where: { caseId } });
    await tx.caseClosureRequest.deleteMany({ where: { caseId } });
    await tx.caseReopenLog.deleteMany({ where: { caseId } });
    await tx.amicableSettlement.deleteMany({ where: { caseId } });
    await tx.expense.deleteMany({ where: { caseId } });
    await tx.invoice.deleteMany({ where: { caseId } });
    await tx.document.deleteMany({ where: { caseId } });
    await tx.caseParty.deleteMany({ where: { caseId } });
    await tx.caseTeamMember.deleteMany({ where: { caseId } });
    await tx.caseAccessOverride.deleteMany({ where: { caseId } });

    // سجلات غير مرتبطة بمفاتيح أجنبية (تنظيف). نُبقي سجل التدقيق (audit_log) للتتبّع.
    await tx.notification.deleteMany({ where: { resourceType: "Case", resourceId: caseId } });
    await tx.entityChangeLog.deleteMany({ where: { entityType: "case", entityId: caseId } });

    await tx.case.delete({ where: { id: caseId } });
  });
}

/** شبكة أمان الكرون: حذف نهائي للقضايا المحذوفة ناعمًا منذ أكثر من 30 يومًا. يعيد العدد. */
export async function purgeSoftDeletedCases(): Promise<number> {
  const cutoff = new Date(Date.now() - SOFT_DELETE_GRACE_DAYS * 24 * 3600 * 1000);
  const cases = await prisma.case.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: { id: true },
  });
  for (const c of cases) {
    await purgeCaseCompletely(c.id);
  }
  return cases.length;
}
