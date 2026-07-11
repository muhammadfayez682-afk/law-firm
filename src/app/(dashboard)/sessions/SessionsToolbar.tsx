"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SESSION_TYPE_OPTIONS = [
  { value: "hearing", label: "مرافعة" },
  { value: "initial_listening", label: "استماع" },
  { value: "verdict", label: "نطق حكم" },
  { value: "arbitration", label: "تحكيم" },
  { value: "negotiation_meeting", label: "تسوية ودية" },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "مجدولة" },
  { value: "held", label: "انعقدت" },
  { value: "postponed", label: "مؤجلة" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "كل الفترات" },
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
];

const selectClass =
  "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white";

export function SessionsToolbar({
  lawyers,
}: {
  lawyers: { id: string; fullName: string }[];
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
    router.push(`/sessions${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-3"
    >
      <input
        name="q"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="ابحث بعنوان القضية أو رقمها أو اسم العميل..."
        className="min-w-[220px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
      />

      <select
        name="type"
        defaultValue={searchParams.get("type") ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={selectClass}
      >
        <option value="">كل الأنواع</option>
        {SESSION_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

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
        name="period"
        defaultValue={searchParams.get("period") ?? "all"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={selectClass}
      >
        {PERIOD_OPTIONS.map((opt) => (
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
    </form>
  );
}
