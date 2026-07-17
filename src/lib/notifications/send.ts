import type { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "./channels";
import { getDefaultChannels } from "./defaults";
import type { NotificationPayload } from "./types";

/**
 * الدالة الموحّدة لإرسال إشعار:
 *  1. جلب تفضيلات المستخدم لنوع الإشعار (القنوات المختارة).
 *  2. الحفظ في قاعدة البيانات (هو التوصيل داخل النظام).
 *  3. الإرسال عبر كل قناة مفعّلة عبر محوّلها.
 *  4. تحديث سجل التوصيل (deliveryLog).
 */
export async function sendNotification(payload: NotificationPayload) {
  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId: payload.recipientId, type: payload.type } },
  });

  const channels: NotificationChannel[] = preferences?.channels?.length
    ? preferences.channels
    : (payload.channels ?? getDefaultChannels(payload.type));

  const notif = await prisma.notification.create({
    data: {
      recipientId: payload.recipientId,
      type: payload.type,
      priority: payload.priority ?? "normal",
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl ?? null,
      actionLabel: payload.actionLabel ?? null,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
      triggeredById: payload.triggeredById ?? null,
      channels,
      expiresAt: payload.expiresAt ?? null,
    },
    include: { recipient: true },
  });

  const log: Record<string, string> = {};
  for (const channel of channels) {
    const adapter = getAdapter(channel);
    const result = await adapter.send(notif, notif.recipient);
    log[channel] = result.status;
  }

  await prisma.notification.update({
    where: { id: notif.id },
    data: { deliveryLog: log },
  });

  return notif;
}

/** إرسال إشعار واحد لعدة مستقبلين (يُزيل التكرار). */
export async function sendBulkNotification(
  recipientIds: string[],
  payload: Omit<NotificationPayload, "recipientId">
) {
  const unique = [...new Set(recipientIds)];
  return Promise.all(unique.map((id) => sendNotification({ ...payload, recipientId: id })));
}

/**
 * أغلفة آمنة للمُطلقات: لا تُفشل العملية الأساسية أبدًا إذا تعذّر الإشعار.
 * تُستخدم داخل مسارات الـ API بعد نجاح العملية الجوهرية.
 */
export async function notify(payload: NotificationPayload): Promise<void> {
  try {
    await sendNotification(payload);
  } catch (e) {
    console.error("[notifications] فشل إرسال إشعار:", e);
  }
}

export async function notifyBulk(
  recipientIds: string[],
  payload: Omit<NotificationPayload, "recipientId">
): Promise<void> {
  try {
    await sendBulkNotification(recipientIds, payload);
  } catch (e) {
    console.error("[notifications] فشل إرسال إشعارات جماعية:", e);
  }
}
