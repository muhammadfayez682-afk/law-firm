"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { NumberField } from "@/components/ui/NumberField";
import { DuplicateWarningModal } from "@/components/modals/DuplicateWarningModal";
import type { DuplicateMatch, DuplicateType } from "@/lib/duplicateCheck";

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

type DupState = { type: DuplicateType; value: string; existingIn: DuplicateMatch[] } | null;

export function NewClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<"individual" | "company">("individual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<DupState>(null);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);

  async function submit(payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.error === "duplicate_detected") {
        setDup({
          type: data.duplicateInfo.type,
          value: String(payload.phone || payload.nationalIdOrCr || ""),
          existingIn: data.duplicateInfo.existingIn,
        });
        setPending(payload);
        return;
      }
      if (!res.ok) {
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fullName = String(formData.get("fullName") || "").trim();
    if (!fullName) {
      setError("الاسم مطلوب");
      return;
    }
    submit({
      type,
      fullName,
      nationalIdOrCr: formData.get("nationalIdOrCr") || null,
      nationality: formData.get("nationality") || null,
      representativeName: formData.get("representativeName") || null,
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">عميل جديد</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground" aria-label="إغلاق">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("individual")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                type === "individual" ? "bg-gold text-navy" : "border border-black/10 text-navy hover:bg-black/5"
              }`}
            >
              فرد
            </button>
            <button
              type="button"
              onClick={() => setType("company")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                type === "company" ? "bg-gold text-navy" : "border border-black/10 text-navy hover:bg-black/5"
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
                <NumberField name="nationalIdOrCr" label="رقم الهوية" variant="saudi_id" placeholder="1XXXXXXXXX" />
                <div>
                  <label className={labelClass}>الجنسية</label>
                  <input name="nationality" className={inputClass} />
                </div>
              </>
            ) : (
              <>
                <NumberField name="nationalIdOrCr" label="رقم السجل التجاري" variant="cr" placeholder="XXXXXXXXXX" />
                <div>
                  <label className={labelClass}>اسم الممثل</label>
                  <input name="representativeName" className={inputClass} />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberField name="phone" label="الجوال" variant="phone" placeholder="05XXXXXXXX" />
            <div>
              <label className={labelClass}>البريد الإلكتروني</label>
              <input name="email" type="email" className={inputClass} dir="ltr" />
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {loading ? "جارٍ الحفظ..." : "حفظ العميل"}
            </button>
          </div>
        </form>
      </div>

      {dup && (
        <DuplicateWarningModal
          type={dup.type}
          value={dup.value}
          existingIn={dup.existingIn}
          busy={loading}
          onUseExisting={(m) => {
            if (m.clientId) router.push(`/clients/${m.clientId}`);
            onClose();
          }}
          onContinue={() => {
            setDup(null);
            if (pending) submit({ ...pending, force: true });
          }}
          onCancel={() => setDup(null)}
        />
      )}
    </div>
  );
}
