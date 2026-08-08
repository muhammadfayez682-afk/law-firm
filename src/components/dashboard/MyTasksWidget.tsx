import Link from "next/link";
import type { MyTaskRow } from "@/lib/dashboard-role";
import { formatDualDate } from "@/lib/dateUtils";

/** تسمية ولون حالة صف المهمة — يغطّي حالة المكلّف المستقلة وحالة المهمة، مع إبراز المتأخر. */
function statusBadge(row: MyTaskRow): { label: string; className: string } {
  if (row.isOverdue) return { label: "متأخرة", className: "bg-red-100 text-red-700" };
  switch (row.status) {
    case "completed":
      return { label: "منجزة", className: "bg-emerald-100 text-emerald-700" };
    case "in_progress":
      return { label: "قيد التنفيذ", className: "bg-blue-100 text-blue-700" };
    case "declined":
      return { label: "اعتذرت", className: "bg-amber-100 text-amber-700" };
    default:
      return { label: "معلقة", className: "bg-gray-200 text-gray-700" };
  }
}

/** صف يلوّن حسب الإلحاح: متأخر أحمر باهت، قريب الاستحقاق كهرماني باهت. */
function rowTint(row: MyTaskRow): string {
  if (row.isOverdue) return "bg-red-50/70 hover:bg-red-50";
  if (row.isDueSoon) return "bg-amber-50/60 hover:bg-amber-50";
  return "hover:bg-navy/5";
}

export function MyTasksWidget({ tasks }: { tasks: MyTaskRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <h2 className="font-semibold text-navy">🗂️ مهامي</h2>
        <Link href="/tasks" className="text-sm text-gold hover:underline">
          عرض الكل
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-foreground/50">
          لا مهام مسندة إليك حاليًا — وقت مناسب لمراجعة قضاياك 🎯
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-foreground/50">
                <th className="px-5 py-2 font-medium">المهمة</th>
                <th className="px-3 py-2 font-medium">القضية</th>
                <th className="px-3 py-2 font-medium">الاستحقاق</th>
                <th className="px-5 py-2 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {tasks.map((t) => {
                const badge = statusBadge(t);
                return (
                  <tr key={t.id} className={`transition-colors ${rowTint(t)}`}>
                    <td className="px-5 py-2.5">
                      <Link href={`/tasks/${t.id}`} className="block min-w-0">
                        <span className="block truncate font-medium text-navy hover:underline">{t.title}</span>
                        <span className="block font-mono text-[11px] text-foreground/40" dir="ltr">
                          {t.taskNumber}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground/60">
                      {t.caseId ? (
                        <Link href={`/cases/${t.caseId}`} className="hover:underline">
                          {t.caseTitle}
                        </Link>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {t.dueDate ? (
                        <span className={t.isOverdue ? "font-semibold text-red-600" : t.isDueSoon ? "font-medium text-amber-600" : "text-foreground/60"}>
                          {formatDualDate(t.dueDate)}
                        </span>
                      ) : (
                        <span className="text-foreground/30">بلا موعد</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
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
