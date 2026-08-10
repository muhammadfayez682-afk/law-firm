"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AutofillKey, TemplateDefinition } from "@/lib/templates/definitions";

type MatrixValues = Record<string, Record<string, Record<string, string>>>;

const GREEN = "#16342A";

function buildInitialValues(
  definition: TemplateDefinition,
  autofillValues: Partial<Record<AutofillKey, string>>
): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const item of definition.items) {
    if (item.kind === "field") {
      initial[item.key] = item.autofill ? autofillValues[item.autofill] ?? "" : "";
    }
  }
  return initial;
}

export function TemplateFillForm({
  definition,
  autofillValues,
  selectedCaseId,
  selectedSessionId,
  intakeContext,
  availableCases,
  availableSessions,
}: {
  definition: TemplateDefinition;
  autofillValues: Partial<Record<AutofillKey, string>>;
  selectedCaseId: string | null;
  selectedSessionId: string | null;
  intakeContext?: { id: string; requestNumber: string } | null;
  availableCases: { id: string; internalNumber: string; title: string }[];
  availableSessions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(definition, autofillValues)
  );
  const [matrixValues, setMatrixValues] = useState<MatrixValues>({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const inIntakeContext = Boolean(intakeContext);
  const needsCase = definition.linkedTo === "case" || definition.linkedTo === "case_session";
  const needsCaseOptional = definition.linkedTo === "case_optional" && !inIntakeContext;
  const needsSession = definition.linkedTo === "case_session";

  function updateField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateMatrixCell(matrixKey: string, rowKey: string, colKey: string, value: string) {
    setMatrixValues((prev) => ({
      ...prev,
      [matrixKey]: {
        ...prev[matrixKey],
        [rowKey]: {
          ...prev[matrixKey]?.[rowKey],
          [colKey]: value,
        },
      },
    }));
  }

  function onCaseChange(caseId: string) {
    const params = new URLSearchParams();
    if (caseId) params.set("caseId", caseId);
    router.push(`/templates/${definition.key}/fill${params.toString() ? `?${params}` : ""}`);
  }

  function onSessionChange(sessionId: string) {
    const params = new URLSearchParams();
    if (selectedCaseId) params.set("caseId", selectedCaseId);
    if (sessionId) params.set("sessionId", sessionId);
    router.push(`/templates/${definition.key}/fill?${params}`);
  }

  function buildPayload() {
    return {
      caseId: selectedCaseId,
      sessionId: selectedSessionId,
      intakeId: intakeContext?.id ?? null,
      data: { ...values, ...matrixValues },
    };
  }

  function validateLinkage(): string | null {
    if (needsCase && !selectedCaseId) return "الرجاء اختيار القضية أولًا";
    if (needsSession && !selectedSessionId) return "الرجاء اختيار الجلسة أولًا";
    // الحقول الإلزامية (مثل «ملخص الجلسة») — يُفرض أيضًا على الـ API.
    for (const item of definition.items) {
      if (item.kind === "field" && item.required && !(values[item.key] ?? "").trim()) {
        return `حقل «${item.label}» إلزامي`;
      }
    }
    return null;
  }

  async function handleGeneratePdf() {
    const linkageError = validateLinkage();
    if (linkageError) {
      toast.error(linkageError);
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/templates/${definition.key}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر توليد الملف.");
        return;
      }

      const result = await res.json();
      toast.success("تم توليد ملف PDF بنجاح");
      window.open(result.pdfPath, "_blank");
    } catch {
      toast.error("تعذّر توليد الملف.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft() {
    const linkageError = validateLinkage();
    if (linkageError) {
      toast.error(linkageError);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${definition.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر حفظ المسودة.");
        return;
      }

      toast.success("تم حفظ المسودة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {inIntakeContext && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          هذا النموذج مرتبط بطلب الاستلام{" "}
          <span className="font-mono font-semibold" dir="ltr">{intakeContext?.requestNumber}</span>
          {" "}— سينتقل تلقائيًا للقضية عند تفعيلها.
        </div>
      )}
      {(needsCase || needsCaseOptional) && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="min-w-[240px]">
            <label className="mb-1.5 block text-sm font-medium text-navy">
              القضية {needsCase && <span className="text-red-600">*</span>}
            </label>
            <select
              value={selectedCaseId ?? ""}
              onChange={(e) => onCaseChange(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="">
                {needsCaseOptional ? "بدون قضية محددة" : "اختر القضية"}
              </option>
              {availableCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.internalNumber} — {c.title}
                </option>
              ))}
            </select>
          </div>

          {needsSession && selectedCaseId && (
            <div className="min-w-[240px]">
              <label className="mb-1.5 block text-sm font-medium text-navy">
                الجلسة <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedSessionId ?? ""}
                onChange={(e) => onSessionChange(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
              >
                <option value="">اختر الجلسة</option>
                {availableSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* المعاينة الحية — يسار */}
        <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">معاينة حية</h2>
          <LivePreview definition={definition} values={values} matrixValues={matrixValues} />
        </section>

        {/* حقول التعبئة — يمين */}
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-navy">حقول التعبئة</h2>
          <div className="space-y-4">
            {definition.items.map((item) =>
              item.kind === "field" ? (
                <div key={item.key}>
                  <label className="mb-1.5 block text-sm font-medium text-navy">
                    {item.label} {item.required && <span className="text-red-600">*</span>}
                  </label>
                  {item.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={values[item.key] ?? ""}
                      onChange={(e) => updateField(item.key, e.target.value)}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
                    />
                  ) : item.type === "select" ? (
                    <select
                      value={values[item.key] ?? ""}
                      onChange={(e) => updateField(item.key, e.target.value)}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
                    >
                      <option value="">—</option>
                      {item.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={values[item.key] ?? ""}
                      onChange={(e) => updateField(item.key, e.target.value)}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
                    />
                  )}
                </div>
              ) : (
                <div key={item.key} className="rounded-lg border border-black/10 p-3">
                  <p className="mb-2 text-sm font-semibold text-navy">{item.title}</p>
                  <div className="space-y-3">
                    {item.rows.map((row, index) => (
                      <div key={row.key} className="rounded-md bg-black/[0.02] p-2">
                        <p className="mb-1.5 text-xs font-medium text-foreground/60">
                          {row.label || `الصف ${index + 1}`}
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {item.columns.map((col) => (
                            <div key={col.key}>
                              <label className="mb-1 block text-[11px] text-foreground/50">
                                {col.label}
                              </label>
                              {col.type === "select" ? (
                                <select
                                  value={matrixValues[item.key]?.[row.key]?.[col.key] ?? ""}
                                  onChange={(e) =>
                                    updateMatrixCell(item.key, row.key, col.key, e.target.value)
                                  }
                                  className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs outline-none focus:border-gold"
                                >
                                  <option value="">—</option>
                                  {col.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={col.type === "date" ? "date" : "text"}
                                  value={matrixValues[item.key]?.[row.key]?.[col.key] ?? ""}
                                  onChange={(e) =>
                                    updateMatrixCell(item.key, row.key, col.key, e.target.value)
                                  }
                                  className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs outline-none focus:border-gold"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="mt-6 flex gap-3 border-t border-black/5 pt-4">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex-1 rounded-lg border border-navy px-4 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ مسودة"}
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generating}
              className="flex-1 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {generating ? "جارٍ التوليد..." : "توليد PDF"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function LivePreview({
  definition,
  values,
  matrixValues,
}: {
  definition: TemplateDefinition;
  values: Record<string, string>;
  matrixValues: MatrixValues;
}) {
  return (
    <div dir="rtl" className="overflow-x-auto rounded-md border" style={{ borderColor: GREEN }}>
      <div className="border-b-4 px-4 py-3 text-center" style={{ borderColor: GREEN }}>
        <p className="font-amiri text-sm font-bold" style={{ color: GREEN }}>
          شركة قدوم الحقائق للمحاماة والاستشارات القانونية
        </p>
        <p className="mt-2 font-amiri text-base font-bold" style={{ color: GREEN }}>
          {definition.name}
        </p>
      </div>

      <table className="w-full border-collapse text-xs">
        <tbody>
          {definition.items.map((item) => {
            if (item.kind === "field") {
              return (
                <tr key={item.key}>
                  <td
                    className="w-1/4 border p-2 text-center font-semibold text-white"
                    style={{ borderColor: GREEN, background: GREEN }}
                  >
                    {item.label}
                  </td>
                  <td className="border p-2 text-foreground/80" style={{ borderColor: GREEN }}>
                    {values[item.key] || "—"}
                  </td>
                </tr>
              );
            }

            return (
              <Fragment key={item.key}>
                <tr key={`${item.key}-title`}>
                  <td
                    colSpan={item.columns.length + 1}
                    className="border p-2 text-center font-semibold text-white"
                    style={{ borderColor: GREEN, background: GREEN }}
                  >
                    {item.title}
                  </td>
                </tr>
                <tr key={`${item.key}-header`}>
                  <td
                    className="border p-1.5 text-center text-[10px] font-semibold text-white"
                    style={{ borderColor: GREEN, background: GREEN }}
                  >
                    {item.rows.every((r) => r.label) ? "" : "م"}
                  </td>
                  {item.columns.map((col) => (
                    <td
                      key={col.key}
                      className="border p-1.5 text-center text-[10px] font-semibold text-white"
                      style={{ borderColor: GREEN, background: GREEN }}
                    >
                      {col.label}
                    </td>
                  ))}
                </tr>
                {item.rows.map((row, index) => (
                  <tr key={row.key}>
                    <td
                      className="border p-1.5 text-center text-[10px] font-medium"
                      style={{ borderColor: GREEN, background: "#f3f5f4" }}
                    >
                      {row.label || index + 1}
                    </td>
                    {item.columns.map((col) => (
                      <td key={col.key} className="border p-1.5 text-foreground/80" style={{ borderColor: GREEN }}>
                        {matrixValues[item.key]?.[row.key]?.[col.key] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
