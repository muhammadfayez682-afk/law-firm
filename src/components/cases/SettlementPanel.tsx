"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AmicableSettlement, CaseFlowStage, SettlementOutcome, SettlementPlatform } from "@prisma/client";
import { formatDualDate } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";

const OUTCOME_LABELS_AR: Record<SettlementOutcome, string> = {
  pending: "قيد التسوية",
  settled: "تمت التسوية",
  failed: "تعذّر الصلح",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function SettlementPanel({
  caseId,
  stage,
  platform,
  settlement,
  canEdit,
}: {
  caseId: string;
  stage: CaseFlowStage | null;
  platform: SettlementPlatform | null;
  settlement: AmicableSettlement | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<SettlementOutcome>(settlement?.outcome ?? "pending");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  if (!stage || !platform) return null;

  const isQiwa = platform === "qiwa";
  const accentColor = isQiwa ? "#1A4D7C" : "#9A7B3C";
  const bgColor = isQiwa ? "bg-taradhi/5" : "bg-gold/5";
  const buttonColor = isQiwa ? "bg-taradhi" : "bg-gold";

  const daysLeft =
    settlement?.deadlineDate != null
      ? Math.ceil((new Date(settlement.deadlineDate).getTime() - Date.now()) / MS_PER_DAY)
      : null;

  async function updateOutcome(next: SettlementOutcome) {
    setSaving(true);
    setOutcome(next);

    try {
      const res = await fetch(`/api/cases/${caseId}/amicable-settlement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: next }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر تحديث نتيجة التسوية.");
        return;
      }

      toast.success("تم تحديث نتيجة التسوية");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createRequest() {
    setCreating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/amicable-settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر إنشاء سجل التسوية.");
        return;
      }

      toast.success("تم إنشاء سجل التسوية");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={`rounded-xl border ${bgColor} shadow-sm`} style={{ borderColor: accentColor }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <h3 className="font-amiri text-lg font-bold" style={{ color: accentColor }}>
          {stage.labelAr} — {isQiwa ? "منصة قوى" : "منصة تراضي"}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              stage.isMandatory ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {stage.isMandatory ? "إلزامية" : "اختيارية"}
          </span>
          {settlement && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                outcome === "settled"
                  ? "bg-emerald-100 text-emerald-700"
                  : outcome === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-white/70"
              }`}
              style={outcome === "pending" ? { color: accentColor } : undefined}
            >
              {OUTCOME_LABELS_AR[outcome]}
            </span>
          )}
        </div>
      </div>

      {!settlement ? (
        <div className="px-5 pb-5">
          <p className="mb-3 text-sm" style={{ color: accentColor, opacity: 0.85 }}>
            لا يوجد سجل تسوية مرتبط بهذه القضية بعد.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={createRequest}
              disabled={creating}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 ${buttonColor}`}
            >
              {creating ? "جارٍ الإنشاء..." : "إنشاء سجل تسوية"}
            </button>
          )}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-4 px-5 pb-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs opacity-70" style={{ color: accentColor }}>
                رقم الطلب
              </dt>
              <dd className="mt-1 text-sm font-medium text-navy" dir="ltr">
                {settlement.requestNumber ? toEnglishDigits(settlement.requestNumber) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-70" style={{ color: accentColor }}>
                اسم المُصلح
              </dt>
              <dd className="mt-1 text-sm font-medium text-navy">
                {settlement.mediatorName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs opacity-70" style={{ color: accentColor }}>
                تاريخ أول جلسة
              </dt>
              <dd className="mt-1 text-sm font-medium text-navy">
                {settlement.firstSessionDate ? formatDualDate(settlement.firstSessionDate) : "—"}
              </dd>
            </div>
            {daysLeft !== null && outcome === "pending" && (
              <div>
                <dt className="text-xs opacity-70" style={{ color: accentColor }}>
                  المهلة المتبقية
                </dt>
                <dd
                  className={`mt-1 text-sm font-semibold ${daysLeft <= 5 ? "text-red-600" : ""}`}
                  style={daysLeft > 5 ? { color: accentColor } : undefined}
                >
                  {daysLeft > 0 ? `${daysLeft} يومًا متبقية` : "انتهت المهلة"}
                </dd>
              </div>
            )}
            {canEdit && (
              <div>
                <dt className="text-xs opacity-70" style={{ color: accentColor }}>
                  تحديث النتيجة
                </dt>
                <dd className="mt-1">
                  <select
                    value={outcome}
                    disabled={saving}
                    onChange={(e) => updateOutcome(e.target.value as SettlementOutcome)}
                    className="rounded-lg border bg-white px-3 py-1.5 text-sm outline-none"
                    style={{ borderColor: `${accentColor}4d` }}
                  >
                    {Object.entries(OUTCOME_LABELS_AR).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
            )}
          </dl>

          <div className="mx-5 mb-4 rounded-lg bg-white/60 px-4 py-3 text-xs leading-relaxed" style={{ color: accentColor }}>
            في حال نجاح التسوية يصدر محضر صلح معتمد سند تنفيذي.
          </div>

          {stage.platformUrl && (
            <div className="border-t px-5 py-3" style={{ borderColor: `${accentColor}33` }}>
              <a
                href={stage.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90 ${buttonColor}`}
              >
                فتح في {isQiwa ? "قوى" : "تراضي"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                  <path
                    d="M14 5h5v5M19 5l-7 7M6 5H5v14h14v-1"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
