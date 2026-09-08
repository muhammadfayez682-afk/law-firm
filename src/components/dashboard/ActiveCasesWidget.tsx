import Link from "next/link";
import type { ActiveCaseRow } from "@/lib/dashboard-role";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import type { CaseStatus } from "@prisma/client";

export function ActiveCasesWidget({ cases }: { cases: ActiveCaseRow[] }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <h2 className="font-semibold text-navy">⚖️ القضايا النشطة</h2>
        <Link href="/cases" className="text-sm text-gold hover:underline">
          عرض الكل
        </Link>
      </div>

      {cases.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-foreground/50">لا قضايا نشطة على قائمتك حاليًا.</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-navy/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-navy">{c.title}</span>
                  <span className="block truncate text-xs text-foreground/50">
                    {c.clientName}
                    {c.court ? ` · ${c.court}` : ""}
                  </span>
                </span>
                <span className="shrink-0">
                  <CaseStatusBadge status={c.status as CaseStatus} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
