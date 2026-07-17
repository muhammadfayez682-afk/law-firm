import type { Notification, User } from "@prisma/client";
import type { ChannelAdapter, ChannelDeliveryResult } from "../types";

/**
 * قناة الرسائل النصية (SMS) — stub جاهز للتفعيل (مزوّد محلي مثل Unifonic/Taqnyat).
 * حاليًا لا يرسل، يرجع pending.
 */
export const smsAdapter: ChannelAdapter = {
  channel: "sms",
  async send(_notif: Notification, _user: User): Promise<ChannelDeliveryResult> {
    return { status: "pending", error: "قناة SMS غير مفعّلة" };
  },
};
