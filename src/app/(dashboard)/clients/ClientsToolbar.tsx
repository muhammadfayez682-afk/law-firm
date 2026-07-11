"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewClientModal } from "@/components/modals/NewClientModal";

const selectClass =
  "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white";

export function ClientsToolbar({ canCreate }: { canCreate: boolean }) {
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

    router.push(`/clients${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        action="/clients"
        method="get"
        className="flex flex-wrap items-center gap-3"
      >
        <input
          name="q"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="ابحث بالاسم أو رقم الهوية/السجل..."
          className="min-w-[240px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
        />

        <select
          name="type"
          defaultValue={searchParams.get("type") ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={selectClass}
        >
          <option value="">كل الأنواع</option>
          <option value="individual">فرد</option>
          <option value="company">شركة</option>
        </select>

        <select
          name="status"
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={selectClass}
        >
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>

        <button
          type="submit"
          className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
        >
          بحث
        </button>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mr-auto rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            + عميل جديد
          </button>
        )}
      </form>

      {showModal && <NewClientModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
