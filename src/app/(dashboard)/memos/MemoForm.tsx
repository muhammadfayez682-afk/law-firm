"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { MEMO_TYPE_OPTIONS } from "@/lib/memos";

type MemoInitial = {
  id: string;
  title: string;
  memoType: string;
  content: string;
  legalBasis: string | null;
  precedents: string | null;
  circulars: string | null;
};

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function MemoForm({
  mode,
  cases,
  memo,
  fixedCaseId,
}: {
  mode: "new" | "edit";
  cases?: { id: string; title: string; internalNumber: string }[];
  memo?: MemoInitial;
  fixedCaseId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    caseId: fixedCaseId ?? "",
    title: memo?.title ?? "",
    memoType: memo?.memoType ?? MEMO_TYPE_OPTIONS[0],
    content: memo?.content ?? "",
    legalBasis: memo?.legalBasis ?? "",
    precedents: memo?.precedents ?? "",
    circulars: memo?.circulars ?? "",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function persist(): Promise<string | null> {
    // يحفظ (إنشاء أو تعديل) ويعيد معرّف المذكرة، أو null عند الفشل.
    const payload = {
      caseId: form.caseId,
      title: form.title,
      memoType: form.memoType,
      content: form.content,
      legalBasis: form.legalBasis,
      precedents: form.precedents,
      circulars: form.circulars,
    };
    const url = mode === "edit" && memo ? `/api/memos/${memo.id}` : "/api/memos";
    const method = mode === "edit" ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "تعذّر حفظ المذكرة.");
      return null;
    }
    return mode === "edit" && memo ? memo.id : data.id;
  }

  async function saveDraft() {
    if (!form.title.trim()) {
      toast.error("عنوان المذكرة مطلوب");
      return;
    }
    if (mode === "new" && !form.caseId) {
      toast.error("اختر القضية");
      return;
    }
    setLoading(true);
    try {
      const id = await persist();
      if (!id) return;
      toast.success("تم حفظ المسودة");
      router.push(`/memos/${id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function submitForReview() {
    if (!form.title.trim()) {
      toast.error("عنوان المذكرة مطلوب");
      return;
    }
    if (mode === "new" && !form.caseId) {
      toast.error("اختر القضية");
      return;
    }
    setLoading(true);
    try {
      const id = await persist();
      if (!id) return;
      const res = await fetch(`/api/memos/${id}/submit`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر إرسال المذكرة.");
        return;
      }
      toast.success("تم إرسال المذكرة للمحامي للاعتماد");
      router.push(`/memos/${id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>عنوان المذكرة</label>
          <input value={form.title} onChange={(e) => update("title", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>نوع المذكرة</label>
          <select value={form.memoType} onChange={(e) => update("memoType", e.target.value)} className={inputClass}>
            {MEMO_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === "new" && (
        <div>
          <label className={labelClass}>القضية</label>
          <select value={form.caseId} onChange={(e) => update("caseId", e.target.value)} className={inputClass}>
            <option value="">اختر القضية</option>
            {cases?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.internalNumber} — {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>نص المذكرة</label>
        <textarea value={form.content} onChange={(e) => update("content", e.target.value)} rows={10} className={inputClass} />
      </div>

      <div className="rounded-lg border border-black/10 bg-navy/5 p-4">
        <p className="mb-3 text-sm font-semibold text-navy">البحث القانوني المرفق</p>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>الأنظمة واللوائح المستند إليها</label>
            <textarea value={form.legalBasis} onChange={(e) => update("legalBasis", e.target.value)} rows={3} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>السوابق القضائية</label>
            <textarea value={form.precedents} onChange={(e) => update("precedents", e.target.value)} rows={3} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>التعاميم ذات الصلة</label>
            <textarea value={form.circulars} onChange={(e) => update("circulars", e.target.value)} rows={3} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-black/5 pt-4">
        <button
          type="button"
          disabled={loading}
          onClick={saveDraft}
          className="rounded-lg border border-navy/20 px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-60"
        >
          حفظ كمسودة
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={submitForReview}
          className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
        >
          إرسال للمحامي للاعتماد
        </button>
      </div>
    </div>
  );
}
