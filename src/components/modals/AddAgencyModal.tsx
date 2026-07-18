"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { NumberField } from "@/components/ui/NumberField";
import { DefinedField } from "@/components/ui/DefinedField";

function plusOneYear(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

export function AddAgencyModal({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencyNumber, setAgencyNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    if (!agencyNumber.trim()) {
      setError("رقم الوكالة مطلوب");
      return;
    }
    if (!issueDate) {
      setError("تاريخ إصدار الوكالة مطلوب");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/agency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyNumber: agencyNumber.trim(),
          agencyType: fd.get("agencyType"),
          scopeText: fd.get("scopeText") || null,
          issueDate,
          expiryDate: expiryDate || plusOneYear(issueDate),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error === "agency_required" ? data.message : data?.error;
        setError(message ?? "تعذّر حفظ الوكالة.");
        toast.error(message ?? "تعذّر حفظ الوكالة.");
        return;
      }
      toast.success("صدرت الوكالة — القضية نشطة كاملة");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">إضافة الوكالة الشرعية</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground" aria-label="إغلاق">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <NumberField
            name="agencyNumber"
            label="رقم الوكالة"
            variant="agency"
            required
            placeholder="مثال: 441234567"
            onValueChange={setAgencyNumber}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">نوع الوكالة</label>
            <select name="agencyType" defaultValue="general" className={inputClass}>
              <option value="general">عامة</option>
              <option value="special">خاصة</option>
            </select>
          </div>

          <div>
            <DefinedField definitionKey="agency_scope" htmlFor="scopeText" />
            <textarea id="scopeText" name="scopeText" rows={2} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy">
                تاريخ الإصدار <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  if (!expiryDate) setExpiryDate(plusOneYear(e.target.value));
                }}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy">
                تاريخ الانتهاء <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputClass}
                dir="ltr"
              />
              <p className="mt-1 text-xs text-foreground/50">افتراضيًا: سنة من الإصدار</p>
            </div>
          </div>

          <p className="rounded-lg bg-navy/5 px-3 py-2 text-xs text-foreground/60">
            💡 يمكن رفع صورة صك الوكالة لاحقًا من قسم «المستندات» في صفحة القضية.
          </p>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {loading ? "جارٍ الحفظ..." : "حفظ الوكالة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
