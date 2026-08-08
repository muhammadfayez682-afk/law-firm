import Link from "next/link";
import type { MySessionRow } from "@/lib/dashboard-role";
import { formatDualDate, formatTime, getDayNameAr } from "@/lib/dateUtils";

const MODE_LABELS: Record<string, string> = {
  in_person: "حضوري",
  remote: "عن بُعد",
  hybrid: "مختلط",
};

/** وسم اليوم/الغد لإبراز الجلسات الوشيكة. */
function dayTag(row: MySessionRow): { label: string; className: string } | null {
  if (row.isToday) return { label: "اليوم", className: "bg-red-100 text-red-700" };
  if (row.isTomorrow) return { label: "غدًا", className: "bg-amber-100 text-amber-700" };
  return null;
}

export function MySessionsWidget({ sessions }: { sessions: MySessionRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <h2 className="font-semibold text-navy">📅 جلساتي القادمة</h2>
        <Link href="/sessions" className="text-sm text-gold hover:underline">
          عرض الكل
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-foreground/50">لا جلسات قادمة على قضاياك 🌿</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-foreground/50">
                <th className="px-5 py-2 font-medium">القضية</th>
                <th className="px-3 py-2 font-medium">النوع</th>
                <th className="px-3 py-2 font-medium">التاريخ والوقت</th>
                <th className="px-5 py-2 font-medium">المكان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sessions.map((s) => {
                const tag = dayTag(s);
                const soon = s.isToday || s.isTomorrow;
                return (
                  <tr key={s.id} className={`transition-colors ${soon ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-navy/5"}`}>
                    <td className="px-5 py-2.5">
                      <Link href={`/cases/${s.caseId}`} className="block min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium text-navy hover:underline">{s.caseTitle}</span>
                          {tag && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.className}`}>
                              {tag.label}
                            </span>
                          )}
                        </span>
                        <span className="block font-mono text-[11px] text-foreground/40" dir="ltr">
                          {s.caseNumber}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground/60">{s.sessionTypeLabel}</td>
                    <td className="px-3 py-2.5 text-xs text-foreground/70">
                      <span className={soon ? "font-semibold text-navy" : ""}>
                        {getDayNameAr(s.sessionDate)} {formatDualDate(s.sessionDate)} · {formatTime(s.sessionDate)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs">
                      {s.sessionMode !== "in_person" ? (
                        s.meetingLink ? (
                          <a
                            href={s.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            🔗 {MODE_LABELS[s.sessionMode] ?? "عن بُعد"}
                          </a>
                        ) : (
                          <span className="text-foreground/60">{MODE_LABELS[s.sessionMode] ?? "عن بُعد"}</span>
                        )
                      ) : (
                        <span className="text-foreground/60">{s.court || "حضوري"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
