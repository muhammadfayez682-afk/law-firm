"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseType, IntakeSource } from "@prisma/client";
import { INTAKE_SOURCE_LABELS_AR } from "@/lib/intake";
import { saudiPhoneError, VALIDATION_MESSAGES } from "@/lib/validators";
import { DuplicateWarningModal } from "@/components/modals/DuplicateWarningModal";
import { DefinedField } from "@/components/ui/DefinedField";
import type { DuplicateMatch, DuplicateResult, DuplicateType } from "@/lib/duplicateCheck";

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

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";
const sectionTitleClass = "mb-3 font-amiri text-base font-bold text-navy";

type DupState = { type: DuplicateType; value: string; existingIn: DuplicateMatch[] } | null;

export function NewIntakeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientIdNumber, setClientIdNumber] = useState("");
  const [phoneMatch, setPhoneMatch] = useState<DuplicateMatch | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dup, setDup] = useState<DupState>(null);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);

  const phoneError = clientPhone ? saudiPhoneError(clientPhone) : null;

  function onPhoneChange(raw: string) {
    const cleaned = raw.replace(/\D/g, "").slice(0, 10);
    setClientPhone(cleaned);
    setPhoneMatch(null);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (/^05\d{8}$/.test(cleaned)) {
      lookupTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/duplicate-check?type=phone&value=${cleaned}`);
          const data: DuplicateResult = await res.json();
          if (data.hasDuplicate) setPhoneMatch(data.existingIn[0]);
        } catch {
          /* تجاهل أخطاء الفحص الحيّ */
        }
      }, 500);
    }
  }

  function useMatchData(m: DuplicateMatch) {
    if (m.name && !clientName) setClientName(m.name);
    if (m.idNumber) setClientIdNumber(m.idNumber);
    toast.success("تم تعبئة بيانات السجل الموجود");
  }

  async function submit(payload: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.error === "duplicate_detected") {
        setDup({ type: data.duplicateInfo.type, value: String(payload.clientPhone || payload.clientIdNumber || ""), existingIn: data.duplicateInfo.existingIn });
        setPending(payload);
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? "تعذّر إنشاء الطلب.");
        return;
      }
      const conflict = data?.conflict;
      if (conflict?.result === "confirmed") toast.error(`⚠️ تعارض مصالح مؤكد: ${conflict.details}`, { duration: 9000 });
      else if (conflict?.result === "potential") toast(`تعارض محتمل: ${conflict.details}`, { icon: "⚠️", duration: 7000 });
      else toast.success("تم إنشاء طلب الاستلام — لا يوجد تعارض مصالح");
      router.push(`/intake/${data.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const disputeSummary = String(formData.get("disputeSummary") || "").trim();
    if (!clientName.trim()) return setError("اسم العميل مطلوب");
    if (saudiPhoneError(clientPhone)) return setError(VALIDATION_MESSAGES.phone);
    if (clientIdNumber && clientIdNumber.length !== 10) return setError(VALIDATION_MESSAGES.nationalId);
    if (disputeSummary.length < 30) return setError("ملخص النزاع يجب ألا يقل عن 30 حرفًا");

    submit({
      clientName: clientName.trim(),
      clientPhone,
      clientEmail: formData.get("clientEmail") || null,
      clientIdNumber: clientIdNumber || null,
      disputeSummary,
      opposingParty: formData.get("opposingParty"),
      proposedType: formData.get("proposedType") || null,
      source: formData.get("source"),
      referredBy: formData.get("referredBy") || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">طلب استلام جديد</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <section>
            <h3 className={sectionTitleClass}>بيانات العميل</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>الاسم <span className="text-red-600">*</span></label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>الجوال <span className="text-red-600">*</span></label>
                <input
                  value={clientPhone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                  className={`${inputClass} ${phoneError ? "border-red-400" : ""}`}
                />
                {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
                {!phoneError && phoneMatch && (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    ℹ️ هذا الرقم مسجّل لـ <span className="font-semibold">{phoneMatch.name}</span> ({phoneMatch.context})
                    <button type="button" onClick={() => useMatchData(phoneMatch)} className="mr-2 font-semibold text-blue-700 underline">
                      استخدام بياناته
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>البريد الإلكتروني</label>
                <input name="clientEmail" type="email" className={inputClass} dir="ltr" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>رقم الهوية / السجل</label>
                <input
                  value={clientIdNumber}
                  onChange={(e) => setClientIdNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  dir="ltr"
                  className={inputClass}
                />
                {clientIdNumber && clientIdNumber.length !== 10 && (
                  <p className="mt-1 text-xs text-red-600">{VALIDATION_MESSAGES.nationalId}</p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className={sectionTitleClass}>بيانات النزاع</h3>
            <div className="space-y-4">
              <div>
                <DefinedField definitionKey="dispute_summary" required htmlFor="disputeSummary" />
                <textarea id="disputeSummary" name="disputeSummary" rows={4} className={inputClass} />
                <p className="mt-1 text-xs text-foreground/50">30 حرفًا على الأقل</p>
              </div>
              <div>
                <DefinedField definitionKey="opposing_party" required htmlFor="opposingParty" />
                <input id="opposingParty" name="opposingParty" required className={inputClass} />
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

      {dup && (
        <DuplicateWarningModal
          type={dup.type}
          value={dup.value}
          existingIn={dup.existingIn}
          busy={loading}
          onUseExisting={(m) => {
            useMatchData(m);
            setDup(null);
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
