"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { formatDualDate } from "@/lib/dateUtils";
import {
  VERDICT_DEGREE_LABELS_AR,
  VERDICT_RESULT_LABELS_AR,
} from "@/lib/verdicts";

export type VerdictView = {
  id: string;
  degree: keyof typeof VERDICT_DEGREE_LABELS_AR;
  result: keyof typeof VERDICT_RESULT_LABELS_AR;
  verdictNumber: string;
  verdictDate: string;
  ruling: string;
  finality: "pending_finality" | "final_binding";
  finalityConfirmedAt: string | null;
  hasAttachment: boolean;
  createdByName: string;
};

const DEGREE_OPTIONS = Object.entries(VERDICT_DEGREE_LABELS_AR) as [string, string][];
const RESULT_OPTIONS = Object.entries(VERDICT_RESULT_LABELS_AR) as [string, string][];

function FinalityBadge({ finality }: { finality: VerdictView["finality"] }) {
  return finality === "final_binding" ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">🔏 مكتسب القطعية</span>
  ) : (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">⏳ بانتظار القطعية</span>
  );
}

const RESULT_TONE: Record<string, string> = {
  in_favor: "text-emerald-700",
  against: "text-red-700",
  partial: "text-amber-700",
};

export function CaseVerdictsPanel({
  caseId,
  verdicts,
  canWrite,
  appealDeadlineSet,
}: {
  caseId: string;
  verdicts: VerdictView[];
  canWrite: boolean;
  appealDeadlineSet: boolean;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function confirmFinality(verdictId: string) {
    setConfirming(verdictId);
    try {
      const res = await fetch(`/api/cases/${caseId}/verdicts/${verdictId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmFinality: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "تعذّر تأكيد القطعية");
        return;
      }
      toast.success("تأكّد اكتساب الحكم القطعية");
      router.refresh();
    } finally {
      setConfirming(null);
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-navy">⚖️ الأحكام</h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
          >
            ➕ تسجيل صك حكم
          </button>
        )}
      </div>

      {verdicts.length === 0 ? (
        <p className="text-sm text-foreground/50">لا أحكام مسجّلة على هذه القضية بعد.</p>
      ) : (
        <ul className="space-y-3">
          {verdicts.map((v) => (
            <li key={v.id} className="rounded-lg border border-black/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-navy">صك {VERDICT_DEGREE_LABELS_AR[v.degree]}</span>
                  <span className={`font-medium ${RESULT_TONE[v.result] ?? "text-foreground/70"}`}>
                    {VERDICT_RESULT_LABELS_AR[v.result]}
                  </span>
                  <span className="font-mono text-xs text-foreground/50" dir="ltr">
                    رقم {v.verdictNumber}
                  </span>
                  <FinalityBadge finality={v.finality} />
                </span>
                <span className="text-xs text-foreground/50">{formatDualDate(v.verdictDate)}</span>
              </div>

              {v.ruling && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-foreground/70">{v.ruling}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {v.hasAttachment ? (
                  <a
                    href={`/api/verdicts/${v.id}/attachment`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-taradhi hover:underline"
                  >
                    📎 مرفق الصك
                  </a>
                ) : (
                  <span className="text-amber-600">📎 لم يُرفق صك الحكم بعد</span>
                )}
                <span className="text-foreground/40">سجّله: {v.createdByName}</span>
                {canWrite && v.finality === "pending_finality" && (
                  <button
                    type="button"
                    onClick={() => confirmFinality(v.id)}
                    disabled={confirming === v.id}
                    className="rounded-lg border border-emerald-300 px-2.5 py-1 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {confirming === v.id ? "..." : "تأكيد اكتساب القطعية"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <AddVerdictModal
          caseId={caseId}
          appealDeadlineSet={appealDeadlineSet}
          onClose={() => setShowAdd(false)}
        />
      )}
    </section>
  );
}

function AddVerdictModal({
  caseId,
  appealDeadlineSet,
  onClose,
}: {
  caseId: string;
  appealDeadlineSet: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/verdicts`, {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "تعذّر تسجيل الصك");
        return;
      }
      toast.success("سُجّل صك الحكم");
      if (d.suggestAppealDeadline && !appealDeadlineSet) {
        toast("💡 أدخل مهلة الاستئناف من «تعديل البيانات» لتفعيل رصد القطعية.", { duration: 6000 });
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
  const label = "mb-1.5 block text-sm font-medium text-navy";

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-amiri text-lg font-bold text-navy">تسجيل صك حكم</h2>
          <button type="button" onClick={onClose} className="text-lg text-foreground/40 hover:text-navy">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>الدرجة <span className="text-red-600">*</span></label>
              <select name="degree" required defaultValue="" className={field}>
                <option value="" disabled>اختر</option>
                {DEGREE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>النتيجة <span className="text-red-600">*</span></label>
              <select name="result" required defaultValue="" className={field}>
                <option value="" disabled>اختر</option>
                {RESULT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>رقم الصك <span className="text-red-600">*</span></label>
              <input name="verdictNumber" required className={field} dir="ltr" />
            </div>
            <div>
              <label className={label}>تاريخ الصك <span className="text-red-600">*</span></label>
              <input name="verdictDate" type="date" required className={field} dir="ltr" />
            </div>
          </div>
          <div>
            <label className={label}>منطوق الحكم <span className="text-red-600">*</span></label>
            <textarea name="ruling" rows={4} required className={field} />
          </div>
          <div>
            <label className={label}>مرفق الصك (اختياري)</label>
            <input name="attachment" type="file" className="w-full text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {saving ? "جارٍ الحفظ..." : "تسجيل الصك"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
