"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseType, IntakeSource, ServiceType } from "@prisma/client";
import { INTAKE_SOURCE_LABELS_AR } from "@/lib/intake";
import { SERVICE_TYPE_LABELS_AR } from "@/lib/services";
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

type ExistingClient = {
  id: string;
  fullName: string;
  phone: string | null;
  nationalIdOrCr: string | null;
  activeCases: { id: string; internalNumber: string; displayNumber: string | null; title: string; status: string }[];
  services: { id: string; serviceNumber: string; title: string; status: string }[];
};

export function NewIntakeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientIdNumber, setClientIdNumber] = useState("");
  const [phoneMatch, setPhoneMatch] = useState<DuplicateMatch | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // الخطوة 1: نوع الطلب — قضية أو خدمة قانونية.
  const [requestKind, setRequestKind] = useState<"case" | "service">("case");
  // الخطوة 2: عميل موجود أو جديد.
  const [clientMode, setClientMode] = useState<"new" | "existing">("new");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ExistingClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<ExistingClient | null>(null);
  const [relatedCaseId, setRelatedCaseId] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(v.trim())}`);
        const data = await res.json();
        setResults(data.clients ?? []);
      } catch {
        setResults([]);
      }
    }, 400);
  }

  function pickClient(c: ExistingClient) {
    setSelectedClient(c);
    setClientName(c.fullName);
    if (c.phone) setClientPhone(c.phone);
    if (c.nationalIdOrCr) setClientIdNumber(c.nationalIdOrCr);
    setResults([]);
    setSearch("");
  }

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
    const isService = requestKind === "service";
    if (!clientName.trim()) return setError("اسم العميل مطلوب");
    if (saudiPhoneError(clientPhone)) return setError(VALIDATION_MESSAGES.phone);
    if (clientIdNumber && clientIdNumber.length !== 10) return setError(VALIDATION_MESSAGES.nationalId);
    if (disputeSummary.length < 30) {
      return setError(isService ? "وصف الخدمة يجب ألا يقل عن 30 حرفًا" : "ملخص النزاع يجب ألا يقل عن 30 حرفًا");
    }
    if (!isService && !String(formData.get("opposingParty") || "").trim()) {
      return setError("الطرف المقابل مطلوب لفحص التعارض");
    }

    submit({
      requestKind,
      existingClientId: selectedClient?.id ?? null,
      relatedCaseId: !isService && relatedCaseId ? relatedCaseId : null,
      proposedServiceType: isService ? formData.get("proposedServiceType") : null,
      clientName: clientName.trim(),
      clientPhone,
      clientEmail: formData.get("clientEmail") || null,
      clientIdNumber: clientIdNumber || null,
      disputeSummary,
      opposingParty: isService ? null : formData.get("opposingParty"),
      proposedType: isService ? null : formData.get("proposedType") || null,
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
          {/* الخطوة 1: نوع الطلب */}
          <section>
            <h3 className={sectionTitleClass}>1. نوع الطلب</h3>
            <div className="flex gap-2">
              {([
                { v: "case", l: "⚖️ قضية" },
                { v: "service", l: "📄 خدمة قانونية" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setRequestKind(o.v)}
                  className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${requestKind === o.v ? "bg-navy text-white" : "border border-black/10 text-navy hover:bg-black/5"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </section>

          {/* الخطوة 2: العميل */}
          <section>
            <h3 className={sectionTitleClass}>2. العميل</h3>
            <div className="mb-3 flex gap-2">
              {([
                { v: "new", l: "➕ عميل جديد" },
                { v: "existing", l: "🔍 عميل موجود" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => {
                    setClientMode(o.v);
                    if (o.v === "new") { setSelectedClient(null); setRelatedCaseId(""); }
                  }}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${clientMode === o.v ? "bg-gold text-navy" : "border border-black/10 text-navy hover:bg-black/5"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            {clientMode === "existing" && !selectedClient && (
              <div>
                <input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="ابحث بالجوال أو الهوية أو الاسم (3 أحرف على الأقل)..."
                  className={inputClass}
                />
                {results.length > 0 && (
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-black/10 p-1">
                    {results.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pickClient(c)}
                          className="w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-navy/5"
                        >
                          <span className="block font-medium text-navy">{c.fullName}</span>
                          <span className="block text-xs text-foreground/50" dir="ltr">
                            {c.phone ?? "—"} · {c.nationalIdOrCr ?? "—"}
                          </span>
                          <span className="block text-xs text-foreground/50">
                            قضايا نشطة: {c.activeCases.length} · خدمات: {c.services.length}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selectedClient && (
              <div className="rounded-lg border-2 border-gold/40 bg-gold/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{selectedClient.fullName}</p>
                    <p className="text-xs text-foreground/60" dir="ltr">
                      {selectedClient.phone ?? "—"} · {selectedClient.nationalIdOrCr ?? "—"}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setSelectedClient(null); setRelatedCaseId(""); }} className="text-xs text-red-600 underline">
                    تغيير
                  </button>
                </div>

                {selectedClient.activeCases.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium text-navy">القضايا النشطة:</p>
                    <ul className="space-y-0.5 text-xs text-foreground/70">
                      {selectedClient.activeCases.map((c) => (
                        <li key={c.id}>• {c.displayNumber ?? c.internalNumber} — {c.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedClient.services.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-navy">الخدمات السابقة:</p>
                    <ul className="space-y-0.5 text-xs text-foreground/70">
                      {selectedClient.services.map((s) => (
                        <li key={s.id}>• {s.serviceNumber} — {s.title}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {requestKind === "case" && selectedClient.activeCases.length > 0 && (
                  <div className="mt-3">
                    <label className={labelClass}>مرتبط بقضية موجودة؟ (اختياري)</label>
                    <select value={relatedCaseId} onChange={(e) => setRelatedCaseId(e.target.value)} className={inputClass}>
                      <option value="">طلب مستقل</option>
                      {selectedClient.activeCases.map((c) => (
                        <option key={c.id} value={c.id}>{c.displayNumber ?? c.internalNumber} — {c.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </section>

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
            <h3 className={sectionTitleClass}>{requestKind === "service" ? "تفاصيل الخدمة المطلوبة" : "بيانات النزاع"}</h3>
            <div className="space-y-4">
              <div>
                <DefinedField definitionKey="dispute_summary" required htmlFor="disputeSummary" />
                <textarea id="disputeSummary" name="disputeSummary" rows={4} className={inputClass} />
                <p className="mt-1 text-xs text-foreground/50">30 حرفًا على الأقل</p>
              </div>
              {requestKind === "case" && (
                <div>
                  <DefinedField definitionKey="opposing_party" required htmlFor="opposingParty" />
                  <input id="opposingParty" name="opposingParty" className={inputClass} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {requestKind === "service" ? (
                    <>
                      <label className={labelClass}>نوع الخدمة المقترح</label>
                      <select name="proposedServiceType" defaultValue="legal_consultation" className={inputClass}>
                        {Object.entries(SERVICE_TYPE_LABELS_AR).map(([v, l]) => (
                          <option key={v} value={v as ServiceType}>{l}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className={labelClass}>نوع القضية المقترح</label>
                      <select name="proposedType" defaultValue="" className={inputClass}>
                        <option value="">غير محدد</option>
                        {CASE_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </>
                  )}
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
