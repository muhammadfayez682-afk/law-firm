"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function EditCourtNumberModal({
  caseId,
  currentValue,
  onClose,
}: {
  caseId: string;
  currentValue?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const value = String(formData.get("courtCaseNumber") ?? "").trim();
    if (!value) {
      setError("أدخل رقم القضية من المحكمة.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtCaseNumber: value }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error ?? "تعذّر حفظ رقم المحكمة.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("تم حفظ رقم المحكمة");
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
          <h2 className="font-amiri text-xl font-bold text-navy">
            {currentValue ? "تعديل رقم المحكمة" : "إضافة رقم المحكمة"}
          </h2>
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
            <label className="mb-1.5 block text-sm font-medium text-navy">
              رقم القضية من المحكمة
            </label>
            <input
              name="courtCaseNumber"
              defaultValue={currentValue ?? ""}
              autoFocus
              dir="ltr"
              placeholder="مثال: 4568/ي-1447 أو 44567890"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <p className="mt-1.5 text-xs text-foreground/50">
              الرقم كما هو من ناجز أو المحكمة، بدون تنسيق معيّن (أرقام أو حروف أو رموز).
            </p>
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
              className="rounded-lg bg-taradhi px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
