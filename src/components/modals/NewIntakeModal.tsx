"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseType, IntakeSource } from "@prisma/client";
import { INTAKE_SOURCE_LABELS_AR } from "@/lib/intake";

const CASE_TYPE_OPTIONS: { value: CaseType; label: string }[] = [
  { value: "general", label: "عام" },
  { value: "commercial", label: "تجارية" },
  { value: "labor", label: "عمالية" },
  { value: "personal_status", label: "أحوال شخصية" },
  { value: "criminal", label: "جزائية" },
  { value: "administrative", label: "إداري" },
  { value: "committee", label: "لجان" },
  { value: "arbitration", label: "تحكيم" },
  { value: "debt_collection", label: "تحصيل ديون" },
  { value: "other", label: "أخرى" },
];

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";
const sectionTitleClass = "mb-3 font-amiri text-base font-bold text-navy";

export function NewIntakeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const disputeSummary = String(formData.get("disputeSummary") || "").trim();
    if (disputeSummary.length < 30) {
      setError("ملخص النزاع يجب ألا يقل عن 30 حرفًا");
      return;
    }

    setLoading(true);
    const payload = {
      clientName: formData.get("clientName"),
      clientPhone: formData.get("clientPhone"),
      clientEmail: formData.get("clientEmail") || null,
      clientIdNumber: formData.get("clientIdNumber") || null,
      disputeSummary,
      opposingParty: formData.get("opposingParty"),
      proposedType: formData.get("proposedType") || null,
      source: formData.get("source"),
      referredBy: formData.get("referredBy") || null,
    };

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر إنشاء الطلب.");
        return;
      }
      const conflict = data?.conflict;
      if (conflict?.result === "confirmed") {
        toast.error(`⚠️ تعارض مصالح مؤكد: ${conflict.details}`, { duration: 9000 });
      } else if (conflict?.result === "potential") {
        toast(`تعارض محتمل: ${conflict.details}`, { icon: "⚠️", duration: 7000 });
      } else {
        toast.success("تم إنشاء طلب الاستلام — لا يوجد تعارض مصالح");
      }
      router.push(`/intake/${data.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">طلب استلام جديد</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <section>
            <h3 className={sectionTitleClass}>بيانات العميل</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>الاسم <span className="text-red-600">*</span></label>
                <input name="clientName" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>الجوال <span className="text-red-600">*</span></label>
                <input name="clientPhone" required className={inputClass} dir="ltr" placeholder="05XXXXXXXX" />
              </div>
              <div>
                <label className={labelClass}>البريد الإلكتروني</label>
                <input name="clientEmail" type="email" className={inputClass} dir="ltr" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>رقم الهوية / السجل</label>
                <input name="clientIdNumber" className={inputClass} dir="ltr" />
              </div>
            </div>
          </section>

          <section>
            <h3 className={sectionTitleClass}>بيانات النزاع</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  ملخص النزاع <span className="text-red-600">*</span>{" "}
                  <span className="text-xs text-foreground/50">(30 حرفًا على الأقل)</span>
                </label>
                <textarea name="disputeSummary" rows={4} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>
                  الطرف المقابل <span className="text-red-600">*</span>{" "}
                  <span className="text-xs text-foreground/50">(لفحص التعارض)</span>
                </label>
                <input name="opposingParty" required className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>نوع القضية المقترح</label>
                  <select name="proposedType" defaultValue="" className={inputClass}>
                    <option value="">غير محدد</option>
                    {CASE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>مصدر القضية <span className="text-red-600">*</span></label>
                  <select name="source" required defaultValue="" className={inputClass}>
                    <option value="" disabled>اختر المصدر</option>
                    {Object.entries(INTAKE_SOURCE_LABELS_AR).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>من أحال العميل</label>
                <input name="referredBy" className={inputClass} />
              </div>
            </div>
          </section>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {loading ? "جارٍ الحفظ..." : "حفظ وفحص التعارض"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
