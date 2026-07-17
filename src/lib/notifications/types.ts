import type {
  Notification,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  User,
} from "@prisma/client";

/** حمولة إنشاء إشعار — تُمرَّر إلى sendNotification. */
export interface NotificationPayload {
  recipientId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  resourceType?: string;
  resourceId?: string;
  triggeredById?: string;
  channels?: NotificationChannel[];
  expiresAt?: Date;
}

export type ChannelDeliveryStatus = "delivered" | "failed" | "pending";

export interface ChannelDeliveryResult {
  status: ChannelDeliveryStatus;
  error?: string;
}

/**
 * محوّل قناة توصيل — يعزل آلية الإرسال (داخل النظام/بريد/SMS/واتساب) عن المُطلقات.
 * إضافة قناة جديدة لا تتطلب تعديل أي مُطلِق، فقط محوّلًا جديدًا وتسجيله في getAdapter.
 */
export interface ChannelAdapter {
  channel: NotificationChannel;
  send(notif: Notification, user: User): Promise<ChannelDeliveryResult>;
}
