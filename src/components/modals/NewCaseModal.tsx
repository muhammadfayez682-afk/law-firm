"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseFlowStage, CasePriority, CaseType, Client, PartyRole, User } from "@prisma/client";
import {
  CLIENT_PARTY_ROLE_OPTIONS,
  OPPOSING_ROLE,
  PARTY_ROLE_LABELS_AR,
} from "@/lib/parties";
import { partyIdentityError, type PartyType } from "@/lib/validators";
import { NumberField } from "@/components/ui/NumberField";
import { DefinedField } from "@/components/ui/DefinedField";
import { DuplicateWarningModal } from "@/components/modals/DuplicateWarningModal";
import type { DuplicateMatch, DuplicateType } from "@/lib/duplicateCheck";

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

const PRIORITY_OPTIONS: { value: CasePriority; label: string }[] = [
  { value: "normal", label: "عادية" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];

// نوع الطرف المقابل — يحكم تسمية حقل الرقم وقاعدة تحققه.
const PARTY_TYPE_META: Record<PartyType, { label: string; idLabel: string; placeholder: string }> = {
  individual: { label: "فرد", idLabel: "رقم الهوية", placeholder: "1XXXXXXXXX" },
  company: { label: "شركة", idLabel: "رقم السجل التجاري", placeholder: "XXXXXXXXXX" },
  government: { label: "جهة حكومية", idLabel: "رقم مرجعي (اختياري)", placeholder: "بلا رقم" },
};
const PARTY_TYPE_ORDER: PartyType[] = ["individual", "company", "government"];

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";
const sectionTitleClass = "mb-3 font-amiri text-base font-bold text-navy";

export function NewCaseModal({
  clients,
  lawyers,
  onClose,
}: {
  clients: Client[];
  lawyers: User[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientType, setClientType] = useState<"individual" | "company">("individual");
  const [conflictConfirmed, setConflictConfirmed] = useState(false);
  const [dup, setDup] = useState<{ type: DuplicateType; value: string; existingIn: DuplicateMatch[] } | null>(null);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);

  const [allStages, setAllStages] = useState<CaseFlowStage[]>([]);
  const [selectedCaseType, setSelectedCaseType] = useState<string>("");

  const [clientPartyRole, setClientPartyRole] = useState<PartyRole | "">("");
  const [opposingParties, setOpposingParties] = useState<
    { name: string; partyType: PartyType; identityNumber: string; opposingCounsel: string }[]
  >([{ name: "", partyType: "individual", identityNumber: "", opposingCounsel: "" }]);

  const opposingRoleLabel = clientPartyRole
    ? PARTY_ROLE_LABELS_AR[OPPOSING_ROLE[clientPartyRole]]
    : "—";

  function updateOpposing(index: number, field: string, value: string) {
    setOpposingParties((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  useEffect(() => {
    fetch("/api/case-flows")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CaseFlowStage[]) => setAllStages(data))
      .catch(() => setAllStages([]));
  }, []);

  const previewStages = allStages
    .filter((s) => s.caseType === selectedCaseType && s.active)
    .sort((a, b) => a.order - b.order);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const errors: Record<string, string> = {};

    const title = String(formData.get("title") || "").trim();
    const caseType = String(formData.get("caseType") || "");
    const responsibleLawyerId = String(formData.get("responsibleLawyerId") || "");
    const existingClientId = String(formData.get("clientId") || "");
    const newClientFullName = String(formData.get("newClientFullName") || "").trim();

    if (!title) errors.title = "عنوان القضية مطلوب";
    if (!caseType) errors.caseType = "نوع القضية مطلوب";
    if (!responsibleLawyerId) errors.responsibleLawyerId = "المحامي المسؤول مطلوب";

    if (clientMode === "existing" && !existingClientId) {
      errors.clientId = "الرجاء اختيار عميل";
    }
    if (clientMode === "new" && !newClientFullName) {
      errors.newClientFullName = "اسم العميل مطلوب";
    }

    const agencyNumber = String(formData.get("agencyNumber") || "").trim();
    const scopeText = String(formData.get("scopeText") || "").trim();
    const issueDate = String(formData.get("issueDate") || "");
    const expiryDate = String(formData.get("expiryDate") || "");
    const hasAgencyData = Boolean(agencyNumber || scopeText || issueDate || expiryDate);

    if (hasAgencyData) {
      if (!agencyNumber) errors.agencyNumber = "رقم الوكالة مطلوب";
      if (!scopeText) errors.scopeText = "نطاق الوكالة مطلوب";
      if (!issueDate) errors.issueDate = "تاريخ الإصدار مطلوب";
      if (!expiryDate) errors.expiryDate = "تاريخ الانتهاء مطلوب";
    }

    if (!clientPartyRole) {
      errors.clientPartyRole = "صفة موكّلنا في الدعوى مطلوبة";
    }

    if (!conflictConfirmed) {
      errors.conflictCheckConfirmed = "إقرار التحقق من تعارض المصالح إلزامي";
    }

    // تحقق رقم كل طرف مقابل حسب نوعه (جهة حكومية بلا تحقق صارم).
    opposingParties.forEach((p, index) => {
      if (!p.name.trim()) return;
      const idError = partyIdentityError(p.partyType, p.identityNumber);
      if (idError) errors[`opposing_${index}`] = idError;
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("الرجاء تصحيح الحقول المطلوبة أدناه");
      return;
    }

    setFieldErrors({});
    setLoading(true);

    const payload = {
      title,
      caseType,
      courtName: formData.get("courtName") || null,
      responsibleLawyerId,
      priority: formData.get("priority"),
      claimValue: formData.get("claimValue") || null,
      conflictCheckConfirmed: true,
      notes: formData.get("notes") || null,
      clientPartyRole,
      opposingParties: opposingParties
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          role: clientPartyRole ? OPPOSING_ROLE[clientPartyRole] : undefined,
          partyType: p.partyType,
          identityNumber: p.identityNumber.trim() || null,
          opposingCounsel: p.opposingCounsel.trim() || null,
        })),
      ...(clientMode === "existing"
        ? { clientId: existingClientId }
        : {
            newClient: {
              type: clientType,
              fullName: newClientFullName,
              nationalIdOrCr: formData.get("newClientNationalIdOrCr") || null,
              nationality: formData.get("newClientNationality") || null,
              representativeName: formData.get("newClientRepresentativeName") || null,
              phone: formData.get("newClientPhone") || null,
              email: formData.get("newClientEmail") || null,
            },
          }),
      ...(hasAgencyData
        ? {
            agency: {
              agencyNumber,
              agencyType: formData.get("agencyType"),
              scopeText,
              issueDate,
              expiryDate,
            },
          }
        : {}),
    };

    await submit(payload);
  }

  async function submit(payload: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (res.status === 409 && data?.error === "duplicate_detected") {
        setDup({ type: data.duplicateInfo.type, value: "", existingIn: data.duplicateInfo.existingIn });
        setPending(payload);
        return;
      }
      if (!res.ok) {
        const message = data?.error ?? "تعذّر إنشاء القضية.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("تم إنشاء القضية بنجاح");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">قضية جديدة</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {/* القسم 1: بيانات العميل */}
          <section>
            <h3 className={sectionTitleClass}>1. بيانات العميل</h3>

            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setClientMode("existing")}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  clientMode === "existing"
                    ? "bg-navy text-white"
                    : "border border-black/10 text-navy hover:bg-black/5"
                }`}
              >
                عميل حالي
              </button>
              <button
                type="button"
                onClick={() => setClientMode("new")}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  clientMode === "new"
                    ? "bg-navy text-white"
                    : "border border-black/10 text-navy hover:bg-black/5"
                }`}
              >
                عميل جديد
              </button>
            </div>

            {clientMode === "existing" ? (
              <div>
                <label className={labelClass}>العميل</label>
                <select name="clientId" className={inputClass}>
                  <option value="">اختر العميل</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                {fieldErrors.clientId && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.clientId}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClientType("individual")}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                      clientType === "individual"
                        ? "bg-gold text-navy"
                        : "border border-black/10 text-navy hover:bg-black/5"
                    }`}
                  >
                    فرد
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientType("company")}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                      clientType === "company"
                        ? "bg-gold text-navy"
                        : "border border-black/10 text-navy hover:bg-black/5"
                    }`}
                  >
                    شركة
                  </button>
                </div>

                <div>
                  <label className={labelClass}>
                    {clientType === "individual" ? "الاسم الكامل" : "اسم الشركة"}
                  </label>
                  <input name="newClientFullName" className={inputClass} />
                  {fieldErrors.newClientFullName && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.newClientFullName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {clientType === "individual" ? (
                    <>
                      <NumberField name="newClientNationalIdOrCr" label="رقم الهوية" variant="saudi_id" placeholder="1XXXXXXXXX" />
                      <div>
                        <label className={labelClass}>الجنسية</label>
                        <input name="newClientNationality" className={inputClass} />
                      </div>
                    </>
                  ) : (
                    <>
                      <NumberField name="newClientNationalIdOrCr" label="رقم السجل التجاري" variant="cr" placeholder="XXXXXXXXXX" />
                      <div>
                        <label className={labelClass}>اسم الممثل</label>
                        <input name="newClientRepresentativeName" className={inputClass} />
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <NumberField name="newClientPhone" label="الجوال" variant="phone" placeholder="05XXXXXXXX" />
                  <div>
                    <label className={labelClass}>البريد الإلكتروني</label>
                    <input name="newClientEmail" type="email" className={inputClass} dir="ltr" />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* القسم 2: الوكالة */}
          <section>
            <h3 className={sectionTitleClass}>2. الوكالة (اختياري)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <NumberField name="agencyNumber" label="رقم الوكالة" variant="agency" />
                {fieldErrors.agencyNumber && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.agencyNumber}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>نوع الوكالة</label>
                <select name="agencyType" defaultValue="general" className={inputClass}>
                  <option value="general">عامة</option>
                  <option value="special">خاصة</option>
                </select>
              </div>
              <div className="col-span-2">
                <DefinedField definitionKey="agency_scope" htmlFor="scopeText" />
                <input id="scopeText" name="scopeText" className={inputClass} />
                {fieldErrors.scopeText && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.scopeText}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>تاريخ الإصدار</label>
                <input name="issueDate" type="date" className={inputClass} />
                {fieldErrors.issueDate && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.issueDate}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>تاريخ الانتهاء</label>
                <input name="expiryDate" type="date" className={inputClass} />
                {fieldErrors.expiryDate && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.expiryDate}</p>
                )}
              </div>
            </div>
          </section>

          {/* القسم 3: القضية */}
          <section>
            <h3 className={sectionTitleClass}>3. القضية</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>عنوان القضية</label>
                <input name="title" className={inputClass} />
                {fieldErrors.title && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <DefinedField definitionKey="case_type" required htmlFor="caseType" />
                  <select
                    id="caseType"
                    name="caseType"
                    value={selectedCaseType}
                    onChange={(e) => setSelectedCaseType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      اختر النوع
                    </option>
                    {CASE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.caseType && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.caseType}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>الأولوية</label>
                  <select name="priority" defaultValue="normal" className={inputClass}>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCaseType && (
                <div className="rounded-lg border border-black/10 bg-navy/5 p-3">
                  <p className="mb-2 text-xs font-medium text-foreground/60">
                    المسار القضائي المتوقع
                  </p>
                  {previewStages.length > 0 ? (
                    <ol className="space-y-1.5">
                      {previewStages.map((stage, i) => (
                        <li key={stage.id} className="flex items-center gap-2 text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white">
                            {i + 1}
                          </span>
                          <span className="text-navy">{stage.labelAr}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              stage.isMandatory
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {stage.isMandatory ? "إلزامي" : "اختياري"}
                          </span>
                          {stage.authority && (
                            <span className="text-xs text-foreground/50">{stage.authority}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-foreground/60">
                      لا مراحل تسوية محددة — القضية تُرفع للمحكمة مباشرة
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className={labelClass}>المحامي المسؤول</label>
                <select name="responsibleLawyerId" defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    اختر المحامي
                  </option>
                  {lawyers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName}
                    </option>
                  ))}
                </select>
                {fieldErrors.responsibleLawyerId && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.responsibleLawyerId}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>المحكمة</label>
                  <input name="courtName" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>قيمة المطالبة</label>
                  <input name="claimValue" type="number" step="0.01" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>ملاحظات</label>
                <textarea name="notes" rows={3} className={inputClass} />
              </div>
            </div>
          </section>

          {/* القسم 4: أطراف الدعوى */}
          <section>
            <h3 className={sectionTitleClass}>4. أطراف الدعوى</h3>

            <div className="mb-4 rounded-lg border-2 border-gold/40 bg-gold/5 p-4">
              <DefinedField definitionKey="client_party_role" required htmlFor="clientPartyRole" />
              <select
                id="clientPartyRole"
                value={clientPartyRole}
                onChange={(e) => setClientPartyRole(e.target.value as PartyRole)}
                className={inputClass}
              >
                <option value="">اختر صفة موكّلنا</option>
                {CLIENT_PARTY_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {PARTY_ROLE_LABELS_AR[role]}
                  </option>
                ))}
              </select>
              {fieldErrors.clientPartyRole && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.clientPartyRole}</p>
              )}
            </div>

            <p className="mb-2 text-sm font-medium text-navy">
              الطرف المقابل{clientPartyRole ? ` (الصفة: ${opposingRoleLabel})` : ""}
            </p>
            <div className="space-y-3">
              {opposingParties.map((party, index) => (
                <div key={index} className="rounded-lg border border-black/10 p-3">
                  <div className="mb-3">
                    <label className={labelClass}>نوع الطرف</label>
                    <div className="flex gap-2">
                      {PARTY_TYPE_ORDER.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateOpposing(index, "partyType", t)}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            party.partyType === t
                              ? "bg-gold text-navy"
                              : "border border-black/10 text-navy hover:bg-black/5"
                          }`}
                        >
                          {PARTY_TYPE_META[t].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelClass}>الاسم</label>
                      <input
                        value={party.name}
                        onChange={(e) => updateOpposing(index, "name", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{PARTY_TYPE_META[party.partyType].idLabel}</label>
                      <input
                        value={party.identityNumber}
                        onChange={(e) =>
                          updateOpposing(
                            index,
                            "identityNumber",
                            party.partyType === "government"
                              ? e.target.value.slice(0, 30)
                              : e.target.value.replace(/\D/g, "").slice(0, 10),
                          )
                        }
                        inputMode={party.partyType === "government" ? "text" : "numeric"}
                        maxLength={party.partyType === "government" ? 30 : 10}
                        placeholder={PARTY_TYPE_META[party.partyType].placeholder}
                        className={inputClass}
                        dir="ltr"
                      />
                      {fieldErrors[`opposing_${index}`] && (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors[`opposing_${index}`]}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>محامي الطرف المقابل</label>
                      <input
                        value={party.opposingCounsel}
                        onChange={(e) => updateOpposing(index, "opposingCounsel", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {opposingParties.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setOpposingParties((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="mt-2 text-xs font-medium text-red-600 hover:underline"
                    >
                      إزالة هذا الطرف
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setOpposingParties((prev) => [
                  ...prev,
                  { name: "", partyType: "individual", identityNumber: "", opposingCounsel: "" },
                ])
              }
              className="mt-3 rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
            >
              + إضافة طرف آخر
            </button>
          </section>

          <div>
            <label className="flex items-start gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={conflictConfirmed}
                onChange={(e) => setConflictConfirmed(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span>
                أقرّ بالتحقق من عدم وجود تعارض مصالح لهذه القضية{" "}
                <span className="text-red-600">*</span>
              </span>
            </label>
            {fieldErrors.conflictCheckConfirmed && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.conflictCheckConfirmed}</p>
            )}
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
              {loading ? "جارٍ الحفظ..." : "إنشاء القضية"}
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
