"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AUDIT_ACTION_LABELS_AR, RESOURCE_TYPE_LABELS_AR } from "@/lib/audit";

const selectClass =
  "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white";

export function AuditToolbar({
  users,
}: {
  users: { id: string; fullName: string }[];
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
    router.push(`/audit${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const exportHref = `/api/audit/export${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="ابحث بالمستخدم أو المورد..."
          className="min-w-[200px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
        />

        <select name="userId" defaultValue={searchParams.get("userId") ?? ""} className={selectClass}>
          <option value="">كل المستخدمين</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>

        <select name="action" defaultValue={searchParams.get("action") ?? ""} className={selectClass}>
          <option value="">كل الإجراءات</option>
          {Object.entries(AUDIT_ACTION_LABELS_AR).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          name="resourceType"
          defaultValue={searchParams.get("resourceType") ?? ""}
          className={selectClass}
        >
          <option value="">كل الموارد</option>
          {Object.entries(RESOURCE_TYPE_LABELS_AR).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground/60">
          من
          <input
            name="from"
            type="date"
            defaultValue={searchParams.get("from") ?? ""}
            dir="ltr"
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground/60">
          إلى
          <input
            name="to"
            type="date"
            defaultValue={searchParams.get("to") ?? ""}
            dir="ltr"
            className={selectClass}
          />
        </label>

        <button
          type="submit"
          className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
        >
          تطبيق الفلاتر
        </button>

        <a
          href={exportHref}
          className="mr-auto rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          تصدير CSV
        </a>
      </div>
    </form>
  );
}
