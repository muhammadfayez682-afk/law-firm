import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/rbac";
import { TriggerRemindersButton } from "./TriggerRemindersButton";

/** أداة تطوير: تشغيل فحص التذكيرات يدويًا — مسؤول النظام + بيئة التطوير فقط. */
export default async function TriggerRemindersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  if (!isSystemAdmin(session.user.role) || process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">فحص التذكيرات اليدوي</h1>
        <p className="text-sm text-foreground/60">
          يشغّل <code className="rounded bg-black/5 px-1">checkTimeSensitiveNotifications</code> فورًا
          (تذكيرات الجلسات، الوكالات، مهل التسوية، المهام، الفواتير).
        </p>
      </div>
      <TriggerRemindersButton />
    </div>
  );
}
