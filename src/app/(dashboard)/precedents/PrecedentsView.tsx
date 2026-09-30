"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseType, PrecedentSource, VerdictDegree, VerdictResult } from "@prisma/client";
import {
  PRECEDENT_CASE_TYPE_LABELS_AR,
  PRECEDENT_CASE_TYPE_STYLES,
  PRECEDENT_SOURCE_LABELS_AR,
  VERDICT_DEGREE_LABELS_AR,
  VERDICT_RESULT_LABELS_AR,
} from "@/lib/precedents";
import { formatDualDate } from "@/lib/dateUtils";

export type Precedent = {
  id: string;
  title: string;
  principle: string;
  fullText: string | null;
  court: string | null;
  caseType: CaseType;
  degree: VerdictDegree | null;
  result: VerdictResult | null;
  judgmentNumber: string | null;
  judgmentDate: string | null;
  keywords: string[];
  source: PrecedentSource;
  hasAttachment: boolean;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";
const filterClass = "rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

export function PrecedentsView({
  precedents,
  canAdd,
  currentUserId,
  isAdmin,
  filters,
}: {
  precedents: Precedent[];
  canAdd: boolean;
  currentUserId: string;
  isAdmin: boolean;
  filters: { q: string; caseType: string; degree: string; source: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<Precedent | null>(null);
  const [editing, setEditing] = useState<Precedent | null>(null);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/precedents?${params.toString()}`);
  }

  const canEditRow = (p: Precedent) => isAdmin || p.createdById === currentUserId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">📚 مدوّنة الأحكام</h1>
          <p className="text-sm text-foreground/60">بنك سوابق قضائية مرجعي — {precedents.length} سابقة</p>
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            ➕ إضافة سابقة
          </button>
        )}
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-white p-3 shadow-sm">
        <input
          type="search"
          defaultValue={filters.q}
          placeholder="ابحث في العنوان أو المبدأ أو المحكمة..."
          onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }}
          className={`${filterClass} flex-1 min-w-[220px]`}
        />
        <select defaultValue={filters.caseType} onChange={(e) => setParam("caseType", e.target.value)} className={filterClass}>
          <option value="">كل التصنيفات</option>
          {Object.entries(PRECEDENT_CASE_TYPE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select defaultValue={filters.degree} onChange={(e) => setParam("degree", e.target.value)} className={filterClass}>
          <option value="">كل الدرجات</option>
          {Object.entries(VERDICT_DEGREE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select defaultValue={filters.source} onChange={(e) => setParam("source", e.target.value)} className={filterClass}>
          <option value="">كل المصادر</option>
          {Object.entries(PRECEDENT_SOURCE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* البطاقات */}
      {precedents.length === 0 ? (
        <div className="rounded-xl border border-black/5 bg-white px-5 py-12 text-center text-foreground/50 shadow-sm">
          لا توجد سوابق مطابقة{canAdd ? " — أضِف أول سابقة لإثراء المدوّنة." : "."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {precedents.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDetail(p)}
              className="flex flex-col gap-2 rounded-xl border border-black/5 bg-white p-4 text-right shadow-sm transition-colors hover:border-gold/40 hover:bg-gold/[0.03]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-navy line-clamp-2">{p.title}</h3>
                {p.hasAttachment && <span className="shrink-0 text-taradhi" title="مرفق">📎</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 font-medium ${PRECEDENT_CASE_TYPE_STYLES[p.caseType]}`}>
                  {PRECEDENT_CASE_TYPE_LABELS_AR[p.caseType]}
                </span>
                {p.degree && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-navy">{VERDICT_DEGREE_LABELS_AR[p.degree]}</span>}
                <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-foreground/60">{PRECEDENT_SOURCE_LABELS_AR[p.source]}</span>
              </div>
              <p className="line-clamp-3 text-sm text-foreground/70">{p.principle}</p>
              <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-foreground/45">
                <span>{p.court ?? "—"}</span>
                <span>{p.judgmentDate ? formatDualDate(p.judgmentDate) : ""}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <PrecedentDetailModal
          precedent={detail}
          canEdit={canEditRow(detail)}
          onEdit={() => { setEditing(detail); setDetail(null); }}
          onClose={() => setDetail(null)}
        />
      )}
      {showAdd && <PrecedentModal mode="add" onClose={() => setShowAdd(false)} />}
      {editing && <PrecedentModal mode="edit" precedent={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-foreground/50">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-navy">{value || "—"}</p>
    </div>
  );
}

function PrecedentDetailModal({
  precedent: p,
  canEdit,
  onEdit,
  onClose,
}: {
  precedent: Precedent;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (!confirm("حذف هذه السابقة نهائيًا من المدوّنة؟")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/precedents/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "تعذّر الحذف.");
        return;
      }
      toast.success("حُذفت السابقة");
      onClose();
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6 pb-4">
          <div>
            <h2 className="font-amiri text-lg font-bold text-navy">{p.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className={`rounded-full px-2 py-0.5 font-medium ${PRECEDENT_CASE_TYPE_STYLES[p.caseType]}`}>{PRECEDENT_CASE_TYPE_LABELS_AR[p.caseType]}</span>
              {p.degree && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-navy">{VERDICT_DEGREE_LABELS_AR[p.degree]}</span>}
              {p.result && <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-foreground/60">{VERDICT_RESULT_LABELS_AR[p.result]}</span>}
              <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-foreground/60">{PRECEDENT_SOURCE_LABELS_AR[p.source]}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-lg text-foreground/40 hover:text-navy">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Row label="المحكمة" value={p.court} />
            <Row label="رقم الحكم" value={p.judgmentNumber} />
            <Row label="تاريخ الحكم" value={p.judgmentDate ? formatDualDate(p.judgmentDate) : "—"} />
          </div>

          <section>
            <h3 className="mb-1 text-sm font-semibold text-navy">المبدأ القانوني</h3>
            <p className="whitespace-pre-wrap rounded-lg bg-gold/[0.06] px-3 py-2 text-sm text-foreground/80">{p.principle}</p>
          </section>

          {p.fullText && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-navy">المنطوق / الحيثيات</h3>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">{p.fullText}</p>
            </section>
          )}

          {p.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.keywords.map((k) => (
                <span key={k} className="rounded-full bg-navy/5 px-2.5 py-0.5 text-xs text-navy">#{k}</span>
              ))}
            </div>
          )}

          {p.hasAttachment && (
            <a
              href={`/api/precedents/${p.id}/attachment`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-taradhi hover:underline"
            >
              📎 فتح مرفق صك الحكم
            </a>
          )}

          <p className="text-xs text-foreground/40">أضافها: {p.createdByName} · {formatDualDate(p.createdAt)}</p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-black/5 px-6 py-4">
            <button type="button" onClick={del} disabled={deleting} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
              {deleting ? "..." : "حذف"}
            </button>
            <button type="button" onClick={onEdit} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
              تعديل
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrecedentModal({
  mode,
  precedent,
  onClose,
}: {
  mode: "add" | "edit";
  precedent?: Precedent;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string)?.trim();
    const principle = (fd.get("principle") as string)?.trim();
    if (!title) return setError("عنوان السابقة مطلوب");
    if (!principle) return setError("المبدأ القانوني مطلوب");

    setLoading(true);
    try {
      let res: Response;
      if (mode === "add") {
        res = await fetch("/api/precedents", { method: "POST", body: fd });
      } else {
        const keywords = String(fd.get("keywords") || "").split(/[،,]/).map((k) => k.trim()).filter(Boolean);
        res = await fetch(`/api/precedents/${precedent!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            principle,
            fullText: fd.get("fullText"),
            court: fd.get("court"),
            caseType: fd.get("caseType"),
            degree: fd.get("degree") || null,
            result: fd.get("result") || null,
            judgmentNumber: fd.get("judgmentNumber"),
            judgmentDate: fd.get("judgmentDate") || null,
            source: fd.get("source"),
            keywords,
          }),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? "تعذّر الحفظ.");
        return;
      }
      toast.success(mode === "add" ? "أُضيفت السابقة" : "حُدّثت السابقة");
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const d = precedent;

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-amiri text-xl font-bold text-navy">{mode === "add" ? "إضافة سابقة قضائية" : "تعديل السابقة"}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
            <div>
              <label className={labelClass}>عنوان/موضوع السابقة <span className="text-red-600">*</span></label>
              <input name="title" defaultValue={d?.title} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>التصنيف <span className="text-red-600">*</span></label>
                <select name="caseType" defaultValue={d?.caseType ?? "general"} className={inputClass}>
                  {Object.entries(PRECEDENT_CASE_TYPE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>المصدر</label>
                <select name="source" defaultValue={d?.source ?? "internal"} className={inputClass}>
                  {Object.entries(PRECEDENT_SOURCE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>الدرجة</label>
                <select name="degree" defaultValue={d?.degree ?? ""} className={inputClass}>
                  <option value="">غير محددة</option>
                  {Object.entries(VERDICT_DEGREE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>النتيجة</label>
                <select name="result" defaultValue={d?.result ?? ""} className={inputClass}>
                  <option value="">غير محددة</option>
                  {Object.entries(VERDICT_RESULT_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>المحكمة</label>
                <input name="court" defaultValue={d?.court ?? ""} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>رقم الحكم</label>
                <input name="judgmentNumber" defaultValue={d?.judgmentNumber ?? ""} className={inputClass} dir="ltr" />
              </div>
              <div>
                <label className={labelClass}>تاريخ الحكم</label>
                <input name="judgmentDate" type="date" defaultValue={d?.judgmentDate ? d.judgmentDate.slice(0, 10) : ""} className={inputClass} dir="ltr" />
              </div>
              <div>
                <label className={labelClass}>وسوم (مفصولة بفواصل)</label>
                <input name="keywords" defaultValue={d?.keywords.join("، ") ?? ""} placeholder="تعويض، فسخ عقد" className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>المبدأ القانوني / الخلاصة <span className="text-red-600">*</span></label>
              <textarea name="principle" defaultValue={d?.principle} rows={3} className={inputClass} placeholder="القاعدة أو المبدأ المستفاد من الحكم..." />
            </div>
            <div>
              <label className={labelClass}>المنطوق / الحيثيات (اختياري)</label>
              <textarea name="fullText" defaultValue={d?.fullText ?? ""} rows={4} className={inputClass} />
            </div>

            {mode === "add" && (
              <div>
                <label className={labelClass}>مرفق صك الحكم (اختياري)</label>
                <input name="attachment" type="file" className="w-full text-sm" />
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
              ⚠️ للمرجع التعليمي — يُفضّل تجهيل البيانات الحسّاسة (الأسماء/الأرقام) في المرفق والنص.
            </div>
          </div>

          <div className="shrink-0 border-t border-black/5 px-6 py-4">
            {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
              <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
                {loading ? "جارٍ الحفظ..." : mode === "add" ? "إضافة السابقة" : "حفظ التعديل"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
