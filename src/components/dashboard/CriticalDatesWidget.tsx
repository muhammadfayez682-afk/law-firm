import Link from "next/link";
import type { CriticalDateItem } from "@/lib/dashboard-role";
import { formatDualDate } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";

/** لون الصف حسب النوع والقرب: مهلة استئناف أحمر متدرّج، غياب المهلة كهرماني، المتابعة أزرق. */
function rowStyle(item: CriticalDateItem): { chip: string; icon: string; countdown: string } {
  if (item.kind === "follow_up") {
    return { chip: "bg-sky-50 text-sky-700 border-sky-200", icon: "🔔", countdown: "text-sky-700" };
  }
  if (item.kind === "appeal_missing") {
    return { chip: "bg-amber-50 text-amber-800 border-amber-200", icon: "⚠️", countdown: "text-amber-700" };
  }
  // appeal — يتدرّج مع القرب
  const d = item.daysLeft ?? 0;
  if (d < 0) return { chip: "bg-rose-100 text-rose-900 border-rose-300", icon: "🛑", countdown: "text-rose-800 font-semibold" };
  if (d <= 3) return { chip: "bg-rose-50 text-rose-800 border-rose-200", icon: "🛑", countdown: "text-rose-700 font-semibold" };
  if (d <= 7) return { chip: "bg-amber-50 text-amber-800 border-amber-200", icon: "🛑", countdown: "text-amber-700" };
  return { chip: "bg-white text-navy border-black/10", icon: "🛑", countdown: "text-foreground/60" };
}

function label(item: CriticalDateItem): string {
  return item.kind === "appeal" || item.kind === "appeal_missing" ? "مهلة استئناف" : "متابعة";
}

function countdownText(item: CriticalDateItem): string {
  if (item.kind === "appeal_missing") return "غير مسجّلة";
  const d = item.daysLeft;
  if (d == null) return "—";
  if (d < 0) return item.kind === "appeal" ? "انقضت" : "فات الموعد";
  if (d === 0) return "اليوم";
  return `متبقٍ ${toEnglishDigits(d)} يومًا`;
}

export function CriticalDatesWidget({ items }: { items: CriticalDateItem[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/60 px-5 py-3">
        <h2 className="font-semibold text-rose-800">🛑 تواريخ حرجة</h2>
        <Link href="/calendar" className="text-sm text-rose-700 hover:underline">التقويم</Link>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-foreground/50">لا مهل استئناف أو متابعات قريبة — لا شيء عاجل 🌿</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {items.map((item) => {
            const st = rowStyle(item);
            return (
              <li key={item.id}>
                <Link href={`/cases/${item.caseId}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-black/[0.02]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.chip}`}>
                      {st.icon} {label(item)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-navy">{item.caseTitle}</span>
                      <span className="block text-xs text-foreground/50">
                        <span className="font-mono" dir="ltr">{item.caseNumber}</span>
                        {item.date ? ` · ${formatDualDate(item.date)}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs ${st.countdown}`}>{countdownText(item)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
