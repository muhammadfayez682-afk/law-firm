"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { INTAKE_SOURCE_LABELS_AR, INTAKE_STATUS_LABELS_AR } from "@/lib/intake";
import { NewIntakeModal } from "@/components/modals/NewIntakeModal";

const selectClass =
  "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white";

export function IntakeToolbar({
  receivers,
}: {
  receivers: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showModal, setShowModal] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) params.set(key, value);
    }
    router.push(`/intake${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="ابحث برقم الطلب أو اسم العميل أو الطرف المقابل..."
          className="min-w-[220px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <select name="status" defaultValue={searchParams.get("status") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
          <option value="">كل الحالات</option>
          {Object.entries(INTAKE_STATUS_LABELS_AR).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select name="source" defaultValue={searchParams.get("source") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
          <option value="">كل المصادر</option>
          {Object.entries(INTAKE_SOURCE_LABELS_AR).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select name="receivedById" defaultValue={searchParams.get("receivedById") ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={selectClass}>
          <option value="">كل المستلمين</option>
          {receivers.map((r) => (
            <option key={r.id} value={r.id}>{r.fullName}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
          بحث
        </button>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mr-auto rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + طلب استلام جديد
        </button>
      </form>

      {showModal && <NewIntakeModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
