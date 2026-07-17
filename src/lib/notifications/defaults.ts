import type { NotificationChannel, NotificationType } from "@prisma/client";
import { ALL_NOTIFICATION_TYPES } from "./meta";

/**
 * القنوات الافتراضية لكل نوع إشعار.
 * حاليًا كل الأنواع → داخل النظام فقط (in_app). القنوات الأخرى (بريد/SMS/واتساب)
 * جاهزة بنيويًا وتُفعَّل لاحقًا عبر تفضيلات المستخدم + متغيرات البيئة.
 */
export const DEFAULT_CHANNELS: NotificationChannel[] = ["in_app"];

export function getDefaultChannels(_type: NotificationType): NotificationChannel[] {
  return [...DEFAULT_CHANNELS];
}

/** التفضيلات الافتراضية الكاملة — كل نوع → القنوات الافتراضية. لبذر المستخدمين الحاليين. */
export function getDefaultPreferences(): { type: NotificationType; channels: NotificationChannel[] }[] {
  return ALL_NOTIFICATION_TYPES.map((type) => ({ type, channels: getDefaultChannels(type) }));
}
