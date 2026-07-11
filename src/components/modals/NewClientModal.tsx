"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function NewClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<"individual" | "company">("individual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const fullName = String(formData.get("fullName") || "").trim();

    if (!fullName) {
      setError("الاسم مطلوب");
      return;
    }

    setLoading(true);

    const payload = {
      type,
      fullName,
      nationalIdOrCr: formData.get("nationalIdOrCr") || null,
      nationality: formData.get("nationality") || null,
      representativeName: formData.get("representativeName") || null,
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error ?? "تعذّر إضافة العميل.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("تمت إضافة العميل بنجاح");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">عميل جديد</h2>
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("individual")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                type === "individual"
                  ? "bg-gold text-navy"
                  : "border border-black/10 text-navy hover:bg-black/5"
              }`}
            >
              فرد
            </button>
            <button
              type="button"
              onClick={() => setType("company")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                type === "company"
                  ? "bg-gold text-navy"
                  : "border border-black/10 text-navy hover:bg-black/5"
              }`}
            >
              شركة
            </button>
          </div>

          <div>
            <label className={labelClass}>{type === "individual" ? "الاسم الكامل" : "اسم الشركة"}</label>
            <input name="fullName" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {type === "individual" ? (
              <>
                <div>
                  <label className={labelClass}>رقم الهوية</label>
                  <input name="nationalIdOrCr" className={inputClass} dir="ltr" />
                </div>
                <div>
                  <label className={labelClass}>الجنسية</label>
                  <input name="nationality" className={inputClass} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClass}>رقم السجل التجاري</label>
                  <input name="nationalIdOrCr" className={inputClass} dir="ltr" />
                </div>
                <div>
                  <label className={labelClass}>اسم الممثل</label>
                  <input name="representativeName" className={inputClass} />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>الجوال</label>
              <input name="phone" className={inputClass} dir="ltr" />
            </div>
            <div>
              <label className={labelClass}>البريد الإلكتروني</label>
              <input name="email" type="email" className={inputClass} dir="ltr" />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
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
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {loading ? "جارٍ الحفظ..." : "حفظ العميل"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
