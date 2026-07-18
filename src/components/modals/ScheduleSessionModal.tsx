"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { SessionType } from "@prisma/client";

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: "hearing", label: "مرافعة" },
  { value: "initial_listening", label: "استماع" },
  { value: "verdict", label: "نطق حكم" },
  { value: "arbitration", label: "تحكيم" },
  { value: "negotiation_meeting", label: "جلسة تسوية ودية" },
];

const REMINDER_OPTIONS = [
  { value: 24 * 60, label: "يوم واحد" },
  { value: 2 * 24 * 60, label: "يومين" },
  { value: 7 * 24 * 60, label: "أسبوع" },
];

// أنواع الجلسات المسموحة قبل صدور الوكالة (لا تحتاج وكالة محكمة).
const AGENCY_FREE_SESSION_TYPES: SessionType[] = ["negotiation_meeting"];

export function ScheduleSessionModal({
  caseId,
  defaultCourt,
  pendingAgency = false,
  onAddAgency,
  onClose,
}: {
  caseId: string;
  defaultCourt?: string | null;
  pendingAgency?: boolean;
  onAddAgency?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      caseId,
      sessionType: formData.get("sessionType"),
      sessionDate: formData.get("sessionDate"),
      court: formData.get("court") || null,
      reminderBefore: formData.get("reminderBefore")
        ? Number(formData.get("reminderBefore"))
        : null,
    };

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error ?? "تعذّر جدولة الجلسة.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("تم جدولة الجلسة بنجاح");
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
          <h2 className="font-amiri text-xl font-bold text-navy">جدولة جلسة</h2>
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
            <label className="mb-1.5 block text-sm font-medium text-navy">نوع الجلسة</label>
            <select
              name="sessionType"
              required
              defaultValue={pendingAgency ? "negotiation_meeting" : undefined}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              {SESSION_TYPE_OPTIONS.map((opt) => {
                const disabled = pendingAgency && !AGENCY_FREE_SESSION_TYPES.includes(opt.value);
                return (
                  <option key={opt.value} value={opt.value} disabled={disabled}>
                    {opt.label}
                    {disabled ? " — يتطلب إصدار الوكالة أولاً" : ""}
                  </option>
                );
              })}
            </select>
            {pendingAgency && (
              <div className="mt-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                ⏳ القضية قيد إصدار الوكالة — جلسات المحكمة معطّلة حتى تصدر الوكالة. يُسمح باجتماعات التسوية الودية فقط.
                {onAddAgency && (
                  <button
                    type="button"
                    onClick={onAddAgency}
                    className="mr-2 font-semibold text-yellow-900 underline"
                  >
                    أضف الوكالة الآن
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">تاريخ ووقت الجلسة</label>
            <input
              name="sessionDate"
              type="datetime-local"
              required
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
              dir="ltr"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">المحكمة / المكان</label>
            <input
              name="court"
              defaultValue={defaultCourt ?? ""}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">التذكير قبل</label>
            <select
              name="reminderBefore"
              defaultValue={REMINDER_OPTIONS[0].value}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              {loading ? "جارٍ الحفظ..." : "جدولة الجلسة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
