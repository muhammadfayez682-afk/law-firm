"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseOutcome, CaseClosureReason } from "@prisma/client";
import { CASE_OUTCOME_LABELS_AR } from "@/lib/caseClosure";
import { CASE_CLOSURE_REASON_LABELS_AR } from "@/lib/verdicts";
import { DefinedField } from "@/components/ui/DefinedField";

const OUTCOME_OPTIONS = Object.entries(CASE_OUTCOME_LABELS_AR) as [CaseOutcome, string][];
const REASON_OPTIONS = Object.entries(CASE_CLOSURE_REASON_LABELS_AR) as [CaseClosureReason, string][];

export function CaseClosureModal({
  caseId,
  hasFinalBindingVerdict,
  hasSettledSettlement,
  onClose,
}: {
  caseId: string;
  hasFinalBindingVerdict: boolean;
  hasSettledSettlement: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<CaseClosureReason | "">("");
  const [note, setNote] = useState("");

  // متطلّب كل سبب (يُطابق منطق الـ API) — يحدّد نص التلميح وتعطيل الزر.
  function requirement(): { met: boolean; hint: string; tone: string } {
    switch (reason) {
      case "verdict":
        return hasFinalBindingVerdict
          ? { met: true, hint: "✓ يوجد صك حكم مكتسب القطعية على القضية.", tone: "text-emerald-700" }
          : { met: false, hint: "⚠️ يتطلب صك حكم مكتسب القطعية — سجّله وأكّد قطعيّته من قسم «الأحكام» أولًا.", tone: "text-red-600" };
      case "settlement":
        return hasSettledSettlement || note.trim()
          ? { met: true, hint: hasSettledSettlement ? "✓ توجد تسوية ودية موثّقة (تمّت)." : "✓ ملاحظة الصلح موثّقة أدناه.", tone: "text-emerald-700" }
          : { met: false, hint: "⚠️ يتطلب تسوية ودية موثّقة (نتيجتها «تمّت») أو ملاحظة توثّق اتفاق الصلح.", tone: "text-red-600" };
      case "withdrawal":
        return note.trim()
          ? { met: true, hint: "✓ ملاحظة التنازل موثّقة.", tone: "text-emerald-700" }
          : { met: false, hint: "⚠️ يتطلب ملاحظة توثّق تنازل الموكل.", tone: "text-red-600" };
      case "dismissal":
        return note.trim()
          ? { met: true, hint: "✓ سبب الشطب موثّق.", tone: "text-emerald-700" }
          : { met: false, hint: "⚠️ يتطلب ملاحظة موجزة بالسبب الإجرائي للشطب.", tone: "text-red-600" };
      default:
        return { met: false, hint: "اختر سبب الإغلاق لعرض متطلّبه.", tone: "text-foreground/50" };
    }
  }

  const req = requirement();
  const canSubmit = Boolean(reason) && req.met && note.trim().length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/cases/${caseId}/closure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: formData.get("outcome"),
          closureReason: reason,
          closureNotes: note,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error ?? "تعذّر إرسال طلب الإغلاق.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("تم إرسال طلب الإغلاق لمسؤول النظام للاعتماد");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">طلب إغلاق القضية</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground" aria-label="إغلاق">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <DefinedField definitionKey="case_outcome" required htmlFor="outcome" />
            <select id="outcome" name="outcome" required defaultValue="" className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold">
              <option value="" disabled>اختر النتيجة</option>
              {OUTCOME_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">سبب الإغلاق <span className="text-red-600">*</span></label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as CaseClosureReason)}
              required
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="" disabled>اختر السبب</option>
              {REASON_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {reason && <p className={`mt-1.5 text-xs ${req.tone}`}>{req.hint}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">ملخص النتيجة / التوثيق <span className="text-red-600">*</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              required
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              title={!canSubmit ? "استوفِ متطلّب سبب الإغلاق أولًا" : undefined}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {loading ? "جارٍ الإرسال..." : "إرسال طلب الإغلاق لمسؤول النظام"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
