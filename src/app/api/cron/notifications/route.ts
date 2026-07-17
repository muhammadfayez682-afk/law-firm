import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkTimeSensitiveNotifications } from "@/lib/notifications/scheduler";

/**
 * فحص الإشعارات المرتبطة بالوقت (تذكيرات الجلسات، الوكالات، مهل التسوية،
 * المهام، الفواتير) وإرسال المستحق.
 *
 * الحماية: ترويسة CRON_SECRET (للجدولة الخارجية cron/systemd/GitHub Actions)،
 * أو جلسة مسؤول نظام في بيئة التطوير (لزر التشغيل اليدوي).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  let authorized = false;
  if (secret && provided && provided === secret) {
    authorized = true;
  } else if (process.env.NODE_ENV !== "production") {
    // في التطوير: نسمح لمسؤول النظام بالتشغيل اليدوي عبر الجلسة.
    const session = await getServerSession(authOptions);
    if (session?.user?.role === "system_admin") authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const results = await checkTimeSensitiveNotifications();
  const total =
    results.sessionReminders +
    results.agencyAlerts +
    results.settlementAlerts +
    results.taskAlerts +
    results.invoiceAlerts;

  return NextResponse.json({ ok: true, total, results });
}
