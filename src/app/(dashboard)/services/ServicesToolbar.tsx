"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SERVICE_STATUS_LABELS_AR, SERVICE_TYPE_LABELS_AR } from "@/lib/services";
import { NewServiceModal } from "@/components/modals/NewServiceModal";

type Opt = { id: string; fullName: string };

export function ServicesToolbar({
  clients,
  users,
  canCreate,
}: {
  clients: Opt[];
  users: Opt[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [showNew, setShowNew] = useState(false);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/services?${params.toString()}`);
  }

  const inputClass = "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-white p-3 shadow-sm">
      <input
        type="search"
        defaultValue={sp.get("q") ?? ""}
        placeholder="ابحث بالرقم أو العنوان أو العميل..."
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
        }}
        className={`${inputClass} flex-1 min-w-[200px]`}
      />
      <select defaultValue={sp.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} className={inputClass}>
        <option value="">كل الحالات</option>
        {Object.entries(SERVICE_STATUS_LABELS_AR).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <select defaultValue={sp.get("serviceType") ?? ""} onChange={(e) => setParam("serviceType", e.target.value)} className={inputClass}>
        <option value="">كل الأنواع</option>
        {Object.entries(SERVICE_TYPE_LABELS_AR).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <select defaultValue={sp.get("assignedToId") ?? ""} onChange={(e) => setParam("assignedToId", e.target.value)} className={inputClass}>
        <option value="">كل المسؤولين</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.fullName}</option>
        ))}
      </select>

      {canCreate && (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="ms-auto rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + خدمة جديدة
        </button>
      )}

      {showNew && <NewServiceModal clients={clients} users={users} onClose={() => setShowNew(false)} />}
    </div>
  );
}
