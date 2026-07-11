"use client";

import { useState } from "react";

export function ReasonPromptModal({
  title,
  label,
  submitLabel,
  submitting,
  submitButtonClassName = "bg-red-600",
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  submitLabel: string;
  submitting: boolean;
  submitButtonClassName?: string;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">{title}</h2>
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
            <label className="mb-1.5 block text-sm font-medium text-navy">{label}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>

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
              disabled={submitting || !reason.trim()}
              className={`rounded-lg px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 ${submitButtonClassName}`}
            >
              {submitting ? "جارٍ الإرسال..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
