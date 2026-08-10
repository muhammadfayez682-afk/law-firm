"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { toGregorian } from "@/lib/dateUtils";

type ReportContext = {
  caseTitle: string;
  caseNumber: string;
  courtCaseNumber: string | null;
  courtName: string | null;
  department: string | null;
  judge: string | null;
  caseTypeLabel: string;
  plaintiff: string | null;
  defendant: string | null;
  responsibleLawyer: string;
  sessionDate: string;
  hijriDate: string | null;
  sessionTypeLabel: string;
  sessionStatus: string;
};

type ReportData = {
  sessionSummary: string;
  courtNotes: string | null;
  proposedDirection: string | null;
  createdByName: string;
  updatedAt: string;
} | null;

const DASH = "—";

function InfoCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-black/5 bg-black/[0.02] px-3 py-2">
      <p className="text-[11px] text-foreground/50">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-navy">{value || DASH}</p>
    </div>
  );
}

export function SessionReportModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [report, setReport] = useState<ReportData>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [blocked, setBlocked] = useState<{ message: string } | null>(null);

  const [summary, setSummary] = useState("");
  const [courtNotes, setCourtNotes] = useState("");
  const [proposed, setProposed] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${sessionId}/report`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setLoadError(d.error);
          return;
        }
        setCtx(d.context);
        setReport(d.report);
        setCanEdit(d.canEdit);
        setBlocked(d.blocked);
        if (d.report) {
          setSummary(d.report.sessionSummary);
          setCourtNotes(d.report.courtNotes ?? "");
          setProposed(d.report.proposedDirection ?? "");
        }
      })
      .catch(() => !cancelled && setLoadError("تعذّر تحميل التقرير"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const dualDate = ctx
    ? `${ctx.hijriDate ?? ""}هـ (${toGregorian(ctx.sessionDate)}م)`
    : "";
  const readOnly = !canEdit || Boolean(blocked);

  async function save() {
    if (!summary.trim()) {
      toast.error("ملخص الجلسة إلزامي");
      return;
    }
    setSaving(true);
    try {
      const method = report ? "PATCH" : "POST";
      const res = await fetch(`/api/sessions/${sessionId}/report`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionSummary: summary, courtNotes, proposedDirection: proposed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "تعذّر حفظ التقرير");
        return;
      }
      toast.success("حُفظ تقرير الجلسة");
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-amiri text-lg font-bold text-navy">تقرير الجلسة</h2>
            {ctx && <p className="text-xs text-foreground/50">{ctx.caseTitle} · {ctx.sessionTypeLabel} · {dualDate}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 text-lg text-foreground/40 hover:text-navy">✕</button>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-black/5" />
        ) : loadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
        ) : ctx ? (
          <>
            {/* البيانات التلقائية (للقراءة) */}
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <InfoCell label="تاريخ الجلسة" value={dualDate} />
              <InfoCell label="المحكمة" value={ctx.courtName} />
              <InfoCell label="الدائرة" value={ctx.department} />
              <InfoCell label="فضيلة القاضي" value={ctx.judge} />
              <InfoCell label="رقم الدعوى" value={ctx.courtCaseNumber ?? ctx.caseNumber} />
              <InfoCell label="التصنيف" value={ctx.caseTypeLabel} />
              <InfoCell label="المدعي" value={ctx.plaintiff} />
              <InfoCell label="المدعى عليه" value={ctx.defendant} />
              <InfoCell label="المحامي المسؤول" value={ctx.responsibleLawyer} />
            </div>

            {blocked && (
              <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{blocked.message}</p>
            )}
            {!canEdit && !blocked && (
              <p className="mb-4 rounded-lg border border-black/10 bg-black/[0.02] px-4 py-2.5 text-sm text-foreground/60">
                عرض فقط — كتابة التقرير للمحامي الحاضر على القضية.
              </p>
            )}

            {/* الخانات المُدخلة */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy">
                  ملخص الجلسة <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={readOnly}
                  placeholder="ما دار في الجلسة من إجراءات وطلبات وقرارات..."
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold disabled:bg-black/[0.03] disabled:text-foreground/70"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy">الملاحظات على ضبط الجلسة</label>
                <textarea
                  rows={3}
                  value={courtNotes}
                  onChange={(e) => setCourtNotes(e.target.value)}
                  disabled={readOnly}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold disabled:bg-black/[0.03] disabled:text-foreground/70"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy">توجّه مقترح (أفكار مبدئية)</label>
                <textarea
                  rows={3}
                  value={proposed}
                  onChange={(e) => setProposed(e.target.value)}
                  disabled={readOnly}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold disabled:bg-black/[0.03] disabled:text-foreground/70"
                />
              </div>
            </div>

            {report && (
              <p className="mt-3 text-xs text-foreground/40">آخر تحديث: {report.createdByName}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
                إغلاق
              </button>
              {canEdit && !blocked && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !summary.trim()}
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
                >
                  {saving ? "جارٍ الحفظ..." : report ? "حفظ التعديل" : "حفظ التقرير"}
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
