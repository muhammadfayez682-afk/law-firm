import type { NotificationChannel } from "@prisma/client";
import type { ChannelAdapter } from "../types";
import { inAppAdapter } from "./inAppAdapter";
import { emailAdapter } from "./emailAdapter";
import { smsAdapter } from "./smsAdapter";
import { whatsappAdapter } from "./whatsappAdapter";

const ADAPTERS: Record<NotificationChannel, ChannelAdapter> = {
  in_app: inAppAdapter,
  email: emailAdapter,
  sms: smsAdapter,
  whatsapp: whatsappAdapter,
};

/** يعيد محوّل القناة المطلوب. */
export function getAdapter(channel: NotificationChannel): ChannelAdapter {
  return ADAPTERS[channel];
}
