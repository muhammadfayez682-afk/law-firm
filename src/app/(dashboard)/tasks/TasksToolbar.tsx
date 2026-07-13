"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  TASK_CATEGORY_LABELS_AR,
  TASK_PRIORITY_LABELS_AR,
  TASK_STATUS_LABELS_AR,
} from "@/lib/tasks";

const selectClass =
  "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white";

export function TasksToolbar({
  users,
  cases,
}: {
  users: { id: string; fullName: string }[];
  cases: { id: string; internalNumber: string; title: string }[];
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
    router.push(`/tasks${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        name="q"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="ابحث بعنوان المهمة أو رقمها..."
        className="min-w-[200px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <select name="status" defaultValue={searchParams.get("status") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل الحالات</option>
        {Object.entries(TASK_STATUS_LABELS_AR)
          .filter(([v]) => v !== "overdue")
          .map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        <option value="overdue">متأخرة</option>
      </select>
      <select name="priority" defaultValue={searchParams.get("priority") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل الأولويات</option>
        {Object.entries(TASK_PRIORITY_LABELS_AR).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <select name="category" defaultValue={searchParams.get("category") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل الفئات</option>
        {Object.entries(TASK_CATEGORY_LABELS_AR).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <select name="assignedToId" defaultValue={searchParams.get("assignedToId") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل الموظفين</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.fullName}</option>
        ))}
      </select>
      <select name="caseId" defaultValue={searchParams.get("caseId") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
        <option value="">كل القضايا</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>{c.internalNumber} — {c.title}</option>
        ))}
      </select>
      <button type="submit" className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
        بحث
      </button>
    </form>
  );
}
