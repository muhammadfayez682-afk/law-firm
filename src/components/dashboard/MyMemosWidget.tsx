import Link from "next/link";
import type { PendingMemoRow } from "@/lib/dashboard-role";

/** وسم حالة المذكرة المعلّقة — مسودة بنفسجي، قيد المراجعة/تعديلات كهرماني. */
const MEMO_STATUS_BADGE: Record<PendingMemoRow["status"], { label: string; className: string }> = {
  draft: { label: "مسودة", className: "bg-purple-100 text-purple-700" },
  submitted: { label: "قيد المراجعة", className: "bg-amber-100 text-amber-700" },
  changes_requested: { label: "تعديلات مطلوبة", className: "bg-orange-100 text-orange-700" },
};

export function MyMemosWidget({ memos }: { memos: PendingMemoRow[] }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <h2 className="font-semibold text-navy">📝 المذكرات المعلّقة</h2>
        <Link href="/memos" className="text-sm text-gold hover:underline">
          عرض الكل
        </Link>
      </div>

      {memos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-foreground/50">لا مذكرات معلّقة — كل المذكرات معتمدة ✅</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {memos.map((m) => {
            const badge = MEMO_STATUS_BADGE[m.status];
            return (
              <li key={m.id}>
                <Link
                  href={`/memos/${m.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-navy/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy">{m.title}</span>
                    <span className="block font-mono text-[11px] text-foreground/45" dir="ltr">
                      {m.caseNumber}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
