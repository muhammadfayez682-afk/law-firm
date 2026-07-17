import type { ChannelAdapter } from "../types";

/**
 * قناة داخل النظام — الحفظ في قاعدة البيانات هو التوصيل نفسه (يظهر في الجرس/الصفحة).
 * لذا نعتبره «مُوصَّل» فور الحفظ.
 */
export const inAppAdapter: ChannelAdapter = {
  channel: "in_app",
  async send() {
    return { status: "delivered" };
  },
};
