import type { Notification, User } from "@prisma/client";
import type { ChannelAdapter, ChannelDeliveryResult } from "../types";

/**
 * قناة واتساب — stub جاهز للتفعيل (WhatsApp Business / Meta Cloud API).
 * حاليًا لا يرسل، يرجع pending.
 */
export const whatsappAdapter: ChannelAdapter = {
  channel: "whatsapp",
  async send(_notif: Notification, _user: User): Promise<ChannelDeliveryResult> {
    return { status: "pending", error: "قناة واتساب غير مفعّلة" };
  },
};
