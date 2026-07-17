import type { Notification, User } from "@prisma/client";
import type { ChannelAdapter, ChannelDeliveryResult } from "../types";

/**
 * قناة البريد الإلكتروني — بنية جاهزة للتفعيل (Resend مثلًا).
 * حاليًا stub: يرجع pending ما لم يُفعَّل عبر EMAIL_ENABLED، دون إرسال فعلي.
 *
 * للتفعيل لاحقًا:
 *  1. ضبط EMAIL_ENABLED=true + RESEND_API_KEY + EMAIL_FROM في البيئة.
 *  2. استبدال جسم الدالة أدناه باستدعاء مزوّد البريد (resend.emails.send).
 *  3. لا حاجة لتعديل أي مُطلِق — sendNotification يستدعي هذا المحوّل تلقائيًا.
 */
export const emailAdapter: ChannelAdapter = {
  channel: "email",
  async send(notif: Notification, user: User): Promise<ChannelDeliveryResult> {
    if (process.env.EMAIL_ENABLED !== "true") {
      return { status: "pending", error: "قناة البريد غير مفعّلة (EMAIL_ENABLED=false)" };
    }
    if (!user.email) {
      return { status: "failed", error: "لا يوجد بريد للمستخدم" };
    }
    // TODO: تنفيذ الإرسال الفعلي عبر مزوّد البريد عند التفعيل.
    // مثال: await resend.emails.send({ from: process.env.EMAIL_FROM, to: user.email,
    //   subject: notif.title, html: renderEmail(notif) });
    return { status: "pending", error: "لم يُنفَّذ مزوّد البريد بعد" };
  },
};
