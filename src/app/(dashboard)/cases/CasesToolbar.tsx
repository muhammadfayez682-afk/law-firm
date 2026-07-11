"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Client, User } from "@prisma/client";
import { NewCaseModal } from "@/components/modals/NewCaseModal";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "intake", label: "استقبال" },
  { value: "amicable_settlement", label: "تراضٍ" },
  { value: "settled_amicably", label: "تمت التسوية وديًا" },
  { value: "open", label: "مفتوحة" },
  { value: "in_progress", label: "قيد النظر" },
  { value: "on_hold", label: "معلّقة" },
  { value: "ruled_first_instance", label: "حُكم ابتدائي" },
  { value: "appealed", label: "مستأنفة" },
  { value: "pending_closure", label: "بانتظار اعتماد الإغلاق" },
  { value: "closed", label: "مغلقة" },
  { value: "archived", label: "مؤرشفة" },
];

const CASE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "general", label: "عام" },
  { value: "commercial", label: "تجارية" },
  { value: "labor", label: "عمالية" },
  { value: "personal_status", label: "أحوال شخصية" },
  { value: "criminal", label: "جزائية" },
  { value: "administrative", label: "إداري" },
  { value: "committee", label: "لجان" },
  { value: "arbitration", label: "تحكيم" },
  { value: "debt_collection", label: "تحصيل ديون" },
  { value: "other", label: "أخرى" },
];

const selectClass =
  "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white";

export function CasesToolbar({
  clients,
  lawyers,
  canCreate,
}: {
  clients: Client[];
  lawyers: User[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value) params.set(key, value);
    }

    router.push(`/cases${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        action="/cases"
        method="get"
        className="flex flex-wrap items-center gap-3"
      >
        <input
          name="q"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="ابحث بعنوان القضية، رقمها، أو اسم العميل..."
          className="min-w-[240px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
        />

        <select
          name="status"
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={selectClass}
        >
          <option value="">كل الحالات</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          name="caseType"
          defaultValue={searchParams.get("caseType") ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={selectClass}
        >
          <option value="">كل الأنواع</option>
          {CASE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          name="lawyerId"
          defaultValue={searchParams.get("lawyerId") ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={selectClass}
        >
          <option value="">كل المحامين</option>
          {lawyers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.fullName}
            </option>
          ))}
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
            onClick={() => setShowNewCaseModal(true)}
            className="mr-auto rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            + قضية جديدة
          </button>
        )}
      </form>

      {showNewCaseModal && (
        <NewCaseModal
          clients={clients}
          lawyers={lawyers}
          onClose={() => setShowNewCaseModal(false)}
        />
      )}
    </div>
  );
}
