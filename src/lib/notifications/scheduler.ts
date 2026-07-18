import type { NotificationType, NotificationPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "./send";
import { getUserIdsByRoles } from "./recipients";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export type SchedulerResults = {
  sessionReminders: number;
  agencyAlerts: number;
  settlementAlerts: number;
  taskAlerts: number;
  invoiceAlerts: number;
  pendingAgencyAlerts: number;
};

/**
 * إرسال إشعار مرة واحدة ضمن نافذة زمنية — يمنع التكرار في التشغيلات المتتابعة
 * لنفس (المستقبل + النوع + المورد) خلال dedupMs. يعيد true إذا أُرسل فعلًا.
 */
async function notifyOnce(
  recipientId: string,
  type: NotificationType,
  resourceId: string,
  dedupMs: number,
  payload: {
    priority: NotificationPriority;
    title: string;
    message: string;
    actionUrl?: string;
    resourceType?: string;
  }
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      recipientId,
      type,
      resourceId,
      createdAt: { gte: new Date(Date.now() - dedupMs) },
    },
    select: { id: true },
  });
  if (existing) return false;

  await sendNotification({
    recipientId,
    type,
    resourceId,
    priority: payload.priority,
    title: payload.title,
    message: payload.message,
    actionUrl: payload.actionUrl,
    resourceType: payload.resourceType,
  });
  return true;
}

/** فحص كل الإشعارات المرتبطة بالوقت وإرسال المستحق منها (مع منع التكرار). */
export async function checkTimeSensitiveNotifications(): Promise<SchedulerResults> {
  const results: SchedulerResults = {
    sessionReminders: 0,
    agencyAlerts: 0,
    settlementAlerts: 0,
    taskAlerts: 0,
    invoiceAlerts: 0,
    pendingAgencyAlerts: 0,
  };
  const now = Date.now();

  // ===== 1. تذكيرات الجلسات (24 ساعة و ساعة) =====
  const upcomingSessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      sessionDate: { gte: new Date(now), lte: new Date(now + 25 * HOUR) },
    },
    include: { case: { include: { team: true } } },
  });
  for (const s of upcomingSessions) {
    const untilMs = new Date(s.sessionDate).getTime() - now;
    const caseNo = s.case.displayNumber ?? s.case.internalNumber;
    for (const m of s.case.team) {
      if (untilMs <= HOUR + 10 * 60 * 1000) {
        // خلال ساعة تقريبًا
        const sent = await notifyOnce(m.userId, "session_reminder_hour", s.id, 50 * 60 * 1000, {
          priority: "urgent",
          title: "جلسة خلال ساعة",
          message: `جلسة في القضية ${caseNo} خلال ساعة تقريبًا.`,
          actionUrl: `/cases/${s.caseId}`,
          resourceType: "session",
        });
        if (sent) results.sessionReminders++;
      } else if (untilMs >= 23 * HOUR && untilMs <= 25 * HOUR) {
        const sent = await notifyOnce(m.userId, "session_reminder_day", s.id, 20 * HOUR, {
          priority: "high",
          title: "جلسة غدًا",
          message: `جلسة في القضية ${caseNo} خلال 24 ساعة.`,
          actionUrl: `/cases/${s.caseId}`,
          resourceType: "session",
        });
        if (sent) results.sessionReminders++;
      }
    }
  }

  // ===== 2. الوكالات (30 و 7 أيام + منتهية) =====
  const adminIds = await getUserIdsByRoles(["system_admin"]);
  const agencies = await prisma.agency.findMany({
    where: { expiryDate: { lte: new Date(now + 30 * DAY) } },
    include: {
      client: {
        include: {
          cases: { where: { status: { notIn: ["closed", "archived"] } }, select: { responsibleLawyerId: true } },
        },
      },
    },
  });
  for (const a of agencies) {
    const untilMs = new Date(a.expiryDate).getTime() - now;
    // المستقبلون: مسؤولو النظام + المحامون المسؤولون عن قضايا العميل النشطة.
    const recipientIds = new Set<string>(adminIds);
    for (const c of a.client.cases) recipientIds.add(c.responsibleLawyerId);

    let type: NotificationType;
    let priority: NotificationPriority;
    let title: string;
    let dedup: number;
    if (untilMs < 0) {
      type = "agency_expired"; priority = "urgent"; title = "انتهت وكالة"; dedup = 7 * DAY;
    } else if (untilMs <= 7 * DAY) {
      type = "agency_expiring_urgent"; priority = "high"; title = "وكالة توشك على الانتهاء"; dedup = 2 * DAY;
    } else {
      type = "agency_expiring_soon"; priority = "normal"; title = "وكالة تقترب من الانتهاء"; dedup = 7 * DAY;
    }
    const days = Math.abs(Math.ceil(untilMs / DAY));
    const msg = untilMs < 0
      ? `انتهت وكالة العميل ${a.client.fullName} (رقم ${a.agencyNumber}) منذ ${days} يومًا.`
      : `وكالة العميل ${a.client.fullName} (رقم ${a.agencyNumber}) تنتهي خلال ${days} يومًا.`;
    for (const rid of recipientIds) {
      const sent = await notifyOnce(rid, type, a.id, dedup, {
        priority, title, message: msg, actionUrl: `/clients/${a.clientId}`, resourceType: "agency",
      });
      if (sent) results.agencyAlerts++;
    }
  }

  // ===== 3. مهل التسوية (7 أيام و يومان) =====
  const settlements = await prisma.amicableSettlement.findMany({
    where: { outcome: "pending", deadlineDate: { not: null, lte: new Date(now + 7 * DAY) } },
    include: { case: { include: { team: true } } },
  });
  for (const st of settlements) {
    if (!st.deadlineDate) continue;
    const untilMs = new Date(st.deadlineDate).getTime() - now;
    if (untilMs < 0) continue; // فات الموعد — لا تذكير مهلة
    const caseNo = st.case.displayNumber ?? st.case.internalNumber;
    const urgent = untilMs <= 2 * DAY;
    const type: NotificationType = urgent ? "settlement_deadline_urgent" : "settlement_deadline_soon";
    const priority: NotificationPriority = urgent ? "urgent" : "normal";
    const dedup = urgent ? 1 * DAY : 3 * DAY;
    const days = Math.ceil(untilMs / DAY);
    for (const m of st.case.team) {
      const sent = await notifyOnce(m.userId, type, st.id, dedup, {
        priority,
        title: urgent ? "مهلة تسوية عاجلة" : "مهلة تسوية تقترب",
        message: `مهلة التسوية في القضية ${caseNo} تنتهي خلال ${days} يومًا.`,
        actionUrl: `/cases/${st.caseId}`,
        resourceType: "settlement",
      });
      if (sent) results.settlementAlerts++;
    }
  }

  // ===== 4. المهام (تقترب و متأخرة) =====
  const openTasks = await prisma.task.findMany({
    where: { status: { in: ["pending", "in_progress"] }, dueDate: { not: null, lte: new Date(now + DAY) } },
  });
  for (const t of openTasks) {
    if (!t.dueDate) continue;
    const untilMs = new Date(t.dueDate).getTime() - now;
    if (untilMs < 0) {
      const sent = await notifyOnce(t.assignedToId, "task_overdue", t.id, DAY, {
        priority: "urgent",
        title: "مهمة متأخرة",
        message: `المهمة «${t.title}» (${t.taskNumber}) تجاوزت موعد استحقاقها.`,
        actionUrl: `/tasks/${t.id}`,
        resourceType: "task",
      });
      if (sent) results.taskAlerts++;
    } else {
      const sent = await notifyOnce(t.assignedToId, "task_due_soon", t.id, 20 * HOUR, {
        priority: "high",
        title: "مهمة تقترب من الاستحقاق",
        message: `المهمة «${t.title}» (${t.taskNumber}) تستحق خلال أقل من يوم.`,
        actionUrl: `/tasks/${t.id}`,
        resourceType: "task",
      });
      if (sent) results.taskAlerts++;
    }
  }

  // ===== 5. الفواتير المتأخرة =====
  const financeIds = await getUserIdsByRoles(["system_admin", "accountant"]);
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["due", "overdue"] }, dueDate: { not: null, lt: new Date(now) } },
    include: { client: { select: { fullName: true } } },
  });
  for (const inv of overdueInvoices) {
    for (const rid of financeIds) {
      const sent = await notifyOnce(rid, "invoice_overdue", inv.id, 7 * DAY, {
        priority: "high",
        title: "فاتورة متأخرة",
        message: `فاتورة العميل ${inv.client.fullName} بقيمة ${inv.amount} تجاوزت موعد استحقاقها.`,
        actionUrl: `/invoices`,
        resourceType: "invoice",
      });
      if (sent) results.invoiceAlerts++;
    }
  }

  // ===== 6. القضايا قيد إصدار الوكالة (تنبيهات متدرجة 3/7/14 يومًا) =====
  results.pendingAgencyAlerts = await checkPendingAgencyCases();

  return results;
}

/**
 * تنبيهات متدرّجة للقضايا التي فُعّلت بلا وكالة (status = pending_agency):
 *  - ≥ 3 أيام: تذكير للمحامي المسؤول.
 *  - ≥ 7 أيام: تنبيه مهم لكل فريق القضية.
 *  - ≥ 14 يومًا: تنبيه عاجل لمسؤولي النظام.
 * نستخدم نطاقات (≥) لا يومًا محددًا حتى لا يفوت التنبيه إن لم يُشغَّل الكرون ذلك اليوم،
 * مع منع التكرار عبر نافذة dedup (7 أيام) لكل مرحلة.
 */
export async function checkPendingAgencyCases(): Promise<number> {
  const now = Date.now();
  const cases = await prisma.case.findMany({
    where: { status: "pending_agency" },
    include: { team: true },
  });
  const adminIds = await getUserIdsByRoles(["system_admin"]);

  let count = 0;
  for (const c of cases) {
    const daysSince = Math.floor((now - new Date(c.openDate).getTime()) / DAY);
    const caseNo = c.displayNumber ?? c.internalNumber;

    if (daysSince >= 14) {
      for (const rid of adminIds) {
        const sent = await notifyOnce(rid, "agency_delayed", c.id, 7 * DAY, {
          priority: "urgent",
          title: "قضية متأخرة الوكالة أسبوعين",
          message: `القضية ${caseNo} — مرّ ${daysSince} يومًا على التفعيل بلا وكالة.`,
          actionUrl: `/cases/${c.id}`,
          resourceType: "Case",
        });
        if (sent) count++;
      }
    } else if (daysSince >= 7) {
      const teamIds = [c.responsibleLawyerId, ...c.team.map((m) => m.userId)];
      for (const rid of new Set(teamIds)) {
        const sent = await notifyOnce(rid, "agency_pending_urgent", c.id, 7 * DAY, {
          priority: "high",
          title: "مطلوب متابعة الموكل للوكالة",
          message: `مرّ أسبوع على تفعيل القضية ${caseNo} بلا وكالة.`,
          actionUrl: `/cases/${c.id}`,
          resourceType: "Case",
        });
        if (sent) count++;
      }
    } else if (daysSince >= 3) {
      const sent = await notifyOnce(c.responsibleLawyerId, "agency_pending_reminder", c.id, 7 * DAY, {
        priority: "normal",
        title: "الوكالة لم تصدر بعد",
        message: `مرّت ${daysSince} أيام على تفعيل القضية ${caseNo} بلا وكالة.`,
        actionUrl: `/cases/${c.id}`,
        resourceType: "Case",
      });
      if (sent) count++;
    }
  }
  return count;
}
