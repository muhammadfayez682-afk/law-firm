"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { ChangeReason } from "@prisma/client";
import { CHANGE_REASON_LABELS_AR } from "@/lib/editPermissions";
import type { TrackedEntityType } from "@/lib/entityChangeTracker";

export type EditableFieldDescriptor = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select";
  value: string;
  locked: boolean;
  lockReason?: string;
  options?: { value: string; label: string }[];
};

const REASON_ORDER: ChangeReason[] = [
  "data_entry_error",
  "official_update",
  "client_information_change",
  "legal_correction",
  "system_migration",
  "other",
];

const MIN_NOTE = 30;
const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold disabled:bg-black/5 disabled:text-foreground/50";

export function EditEntityModal({
  entityType,
  apiPath,
  title,
  fields,
  onClose,
}: {
  entityType: TrackedEntityType;
  entityId: string;
  apiPath: string;
  title: string;
  fields: EditableFieldDescriptor[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.name, f.value]))
  );
  const [reason, setReason] = useState<ChangeReason | "">("");
  const [reasonNote, setReasonNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editableFields = useMemo(() => fields.filter((f) => !f.locked), [fields]);

  // الحقول التي تغيّرت فعليًا (القابلة للتعديل فقط).
  const changedFields = editableFields.filter((f) => (values[f.name] ?? "") !== (f.value ?? ""));
  const hasChanges = changedFields.length > 0;
  const noteOk = reasonNote.trim().length >= MIN_NOTE;
  const canSave = hasChanges && reason !== "" && noteOk && !loading;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setLoading(true);
    try {
      const changes: Record<string, string | null> = {};
      for (const f of changedFields) {
        const v = values[f.name];
        changes[f.name] = v === "" ? null : v;
      }
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, reason, reasonNote: reasonNote.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.message ?? data?.error ?? "تعذّر حفظ التعديلات.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("حُفظت التعديلات وسُجّلت في سجل التعديلات");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-entity-type={entityType} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-black/5 pb-3">
          <h2 className="font-amiri text-xl font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground" aria-label="إغلاق">✕</button>
        </div>

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-navy">
                {f.label}
                {f.locked && (
                  <span title={f.lockReason ?? "مقفل"} className="inline-flex cursor-help items-center text-foreground/40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5">
                      <rect x="5" y="11" width="14" height="9" rx="1.5" strokeWidth="1.7" />
                      <path d="M8 11V7a4 4 0 018 0v4" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
              </label>

              {f.type === "textarea" ? (
                <textarea
                  rows={3}
                  disabled={f.locked}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className={inputClass}
                />
              ) : f.type === "select" ? (
                <select
                  disabled={f.locked}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className={inputClass}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  disabled={f.locked}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className={inputClass}
                  dir={f.type === "number" || f.type === "date" ? "ltr" : undefined}
                />
              )}
              {f.locked && f.lockReason && (
                <p className="mt-1 text-xs text-foreground/40">🔒 {f.lockReason}</p>
              )}
            </div>
          ))}

          {editableFields.length === 0 && (
            <p className="rounded-lg bg-black/5 px-3 py-2 text-sm text-foreground/60">
              لا تملك صلاحية تعديل أي حقل من حقول هذا الكيان في حالته الحالية.
            </p>
          )}

          {/* سبب التعديل + الملاحظة — إلزاميان */}
          {editableFields.length > 0 && (
            <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
              <p className="mb-2 text-sm font-semibold text-red-700">🔴 مطلوب لأي تغيير:</p>

              <label className="mb-1.5 block text-sm font-medium text-navy">
                سبب التعديل <span className="text-red-600">*</span>
              </label>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {REASON_ORDER.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="changeReason"
                      checked={reason === r}
                      onChange={() => setReason(r)}
                    />
                    {CHANGE_REASON_LABELS_AR[r]}
                  </label>
                ))}
              </div>

              <label className="mb-1.5 block text-sm font-medium text-navy">
                ملاحظة توضيحية <span className="text-red-600">*</span>{" "}
                <span className="text-xs text-foreground/50">(30 حرفًا على الأقل)</span>
              </label>
              <textarea
                rows={3}
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="مثال: تم استلام رقم القضية الرسمي من المحكمة اليوم عبر ناجز."
                className={inputClass}
              />
              <p className={`mt-1 text-xs ${noteOk ? "text-emerald-600" : "text-foreground/50"}`}>
                {reasonNote.trim().length} / {MIN_NOTE} حرفًا
              </p>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50"
              title={!hasChanges ? "لم تُعدّل أي حقل" : !reason ? "اختر سبب التعديل" : !noteOk ? "الملاحظة يجب أن تكون 30 حرفًا على الأقل" : ""}
            >
              {loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </div>
      </div>
      {/* entityType متاح للاستخدام المستقبلي (تحليلات/تتبّع) */}
      <span className="hidden" data-entity={entityType} />
    </div>
  );
}
