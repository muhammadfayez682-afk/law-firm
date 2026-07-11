"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MEMO_STATUS_LABELS_AR } from "@/lib/memos";

const selectClass =
  "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white";

export function MemosToolbar({
  cases,
  researchers,
}: {
  cases: { id: string; title: string; internalNumber: string }[];
  researchers: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) params.set(key, value);
    }
    router.push(`/memos${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        name="q"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="ابحث بعنوان المذكرة أو القضية..."
        className="min-w-[200px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <select name="status" defaultValue={searchParams.get("status") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل الحالات</option>
        {Object.entries(MEMO_STATUS_LABELS_AR).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select name="caseId" defaultValue={searchParams.get("caseId") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل القضايا</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.internalNumber} — {c.title}
          </option>
        ))}
      </select>
      <select name="authorId" defaultValue={searchParams.get("authorId") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل الباحثين</option>
        {researchers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.fullName}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
        بحث
      </button>
    </form>
  );
}
