"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseOutcome, ClosureReason } from "@prisma/client";
import { CASE_OUTCOME_LABELS_AR, CLOSURE_REASON_LABELS_AR } from "@/lib/caseClosure";

const OUTCOME_OPTIONS = Object.entries(CASE_OUTCOME_LABELS_AR) as [CaseOutcome, string][];
const CLOSURE_REASON_OPTIONS = Object.entries(CLOSURE_REASON_LABELS_AR) as [ClosureReason, string][];

export function CaseClosureModal({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      outcome: formData.get("outcome"),
      closureReason: formData.get("closureReason"),
      closureNotes: formData.get("closureNotes"),
    };

    try {
      const res = await fetch(`/api/cases/${caseId}/closure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error ?? "تعذّر إرسال طلب الإغلاق.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("تم إرسال طلب الإغلاق للشريك للاعتماد");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">طلب إغلاق القضية</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">نتيجة القضية</label>
            <select
              name="outcome"
              required
              defaultValue=""
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="" disabled>
                اختر النتيجة
              </option>
              {OUTCOME_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">سبب الإغلاق</label>
            <select
              name="closureReason"
              required
              defaultValue=""
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="" disabled>
                اختر السبب
              </option>
              {CLOSURE_REASON_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">ملخص النتيجة</label>
            <textarea
              name="closureNotes"
              rows={4}
              required
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {loading ? "جارٍ الإرسال..." : "إرسال طلب الإغلاق للشريك"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
