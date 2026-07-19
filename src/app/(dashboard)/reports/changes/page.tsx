import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/rbac";
import { CHANGE_REASON_LABELS_AR } from "@/lib/editPermissions";
import { formatDualDateTime } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";

const ENTITY_LABELS: Record<string, string> = {
  case: "قضية",
  client: "عميل",
  agency: "وكالة",
  party: "طرف",
  intake: "طلب استلام",
  memo: "مذكرة",
};

// عتبة تنبيه "مستخدم يعدّل كثيرًا" خلال آخر 30 يومًا.
const HEAVY_EDITOR_THRESHOLD = 15;

export default async function ChangesReportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  if (!isSystemAdmin(session.user.role)) notFound();

  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [total, byField, byReason, byUser, recent] = await Promise.all([
    prisma.entityChangeLog.count(),
    prisma.entityChangeLog.groupBy({ by: ["fieldLabel"], _count: true, orderBy: { _count: { fieldLabel: "desc" } }, take: 8 }),
    prisma.entityChangeLog.groupBy({ by: ["changeReason"], _count: true }),
    prisma.entityChangeLog.groupBy({
      by: ["changedById"],
      _count: true,
      where: { changedAt: { gte: monthAgo } },
      orderBy: { _count: { changedById: "desc" } },
      take: 10,
    }),
    prisma.entityChangeLog.findMany({
      orderBy: { changedAt: "desc" },
      take: 30,
      include: { changedBy: { select: { fullName: true } } },
    }),
  ]);

  const userIds = byUser.map((u) => u.changedById);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } });
  const userName = (uid: string) => users.find((u) => u.id === uid)?.fullName ?? uid;
  const heavyEditors = byUser.filter((u) => u._count >= HEAVY_EDITOR_THRESHOLD);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">تقرير التعديلات</h1>
          <p className="text-sm text-foreground/60">
            إجمالي التعديلات الموثّقة: {toEnglishDigits(total)}
          </p>
        </div>
        <a
          href="/api/change-log/export"
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          تصدير CSV
        </a>
      </div>

      {heavyEditors.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            ⚠️ مستخدمون بكثرة تعديلات خلال 30 يومًا (قد يشير لسوء إدخال):
          </p>
          <ul className="space-y-1 text-sm text-amber-800">
            {heavyEditors.map((u) => (
              <li key={u.changedById} className="flex items-center justify-between">
                <span>{userName(u.changedById)}</span>
                <span className="font-semibold">{toEnglishDigits(u._count)} تعديل</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">أكثر الحقول تعديلاً</h2>
          <ul className="space-y-2 text-sm">
            {byField.map((f) => (
              <li key={f.fieldLabel} className="flex items-center justify-between">
                <span className="text-foreground/70">{f.fieldLabel}</span>
                <span className="font-semibold text-navy">{toEnglishDigits(f._count)}</span>
              </li>
            ))}
            {byField.length === 0 && <li className="text-foreground/50">لا توجد بيانات</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">أكثر الأسباب شيوعاً</h2>
          <ul className="space-y-2 text-sm">
            {byReason
              .sort((a, b) => b._count - a._count)
              .map((r) => (
                <li key={r.changeReason} className="flex items-center justify-between">
                  <span className="text-foreground/70">{CHANGE_REASON_LABELS_AR[r.changeReason]}</span>
                  <span className="font-semibold text-navy">{toEnglishDigits(r._count)}</span>
                </li>
              ))}
            {byReason.length === 0 && <li className="text-foreground/50">لا توجد بيانات</li>}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-black/5 bg-white shadow-sm">
        <h2 className="border-b border-black/5 px-5 py-4 font-semibold text-navy">أحدث التعديلات</h2>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-foreground/50">لا توجد تعديلات بعد</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {recent.map((l) => (
              <li key={l.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/50">
                  <span>{formatDualDateTime(l.changedAt)}</span>
                  <span>
                    {l.changedBy.fullName} · {ENTITY_LABELS[l.entityType] ?? l.entityType}
                  </span>
                </div>
                <p className="mt-1">
                  <span className="font-medium text-navy">{l.fieldLabel}:</span>{" "}
                  <span className="text-red-600 line-through" dir="auto">{l.oldValue ?? "—"}</span>{" "}
                  ← <span className="text-emerald-700" dir="auto">{l.newValue ?? "—"}</span>
                </p>
                <p className="mt-0.5 text-xs text-foreground/50">
                  {CHANGE_REASON_LABELS_AR[l.changeReason]} — «{l.reasonNote}»
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/reports" className="inline-block text-sm text-gold hover:underline">
        ← العودة للتقارير
      </Link>
    </div>
  );
}
