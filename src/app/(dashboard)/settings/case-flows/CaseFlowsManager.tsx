"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseFlowStage, CaseType } from "@prisma/client";

const CASE_TYPE_LABELS_AR: Record<CaseType, string> = {
  general: "عام",
  commercial: "تجارية",
  labor: "عمالية",
  personal_status: "أحوال شخصية",
  criminal: "جزائية",
  administrative: "إداري",
  committee: "لجان",
  arbitration: "تحكيم",
  debt_collection: "تحصيل ديون",
  other: "أخرى",
};

const CASE_TYPE_ORDER: CaseType[] = [
  "general",
  "commercial",
  "personal_status",
  "debt_collection",
  "labor",
  "administrative",
  "committee",
  "criminal",
  "arbitration",
  "other",
];

type StageFormState = {
  order: string;
  key: string;
  labelAr: string;
  isMandatory: boolean;
  authority: string;
  platformUrl: string;
};

const emptyForm: StageFormState = {
  order: "",
  key: "",
  labelAr: "",
  isMandatory: false,
  authority: "",
  platformUrl: "",
};

function toForm(stage: CaseFlowStage): StageFormState {
  return {
    order: String(stage.order),
    key: stage.key,
    labelAr: stage.labelAr,
    isMandatory: stage.isMandatory,
    authority: stage.authority ?? "",
    platformUrl: stage.platformUrl ?? "",
  };
}

export function CaseFlowsManager({ initialStages }: { initialStages: CaseFlowStage[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StageFormState>(emptyForm);
  const [addingFor, setAddingFor] = useState<CaseType | null>(null);
  const [addForm, setAddForm] = useState<StageFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const grouped = new Map<CaseType, CaseFlowStage[]>();
  for (const type of CASE_TYPE_ORDER) grouped.set(type, []);
  for (const stage of initialStages) {
    grouped.get(stage.caseType)?.push(stage);
  }

  function startEdit(stage: CaseFlowStage) {
    setEditingId(stage.id);
    setEditForm(toForm(stage));
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/case-flows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: Number(editForm.order),
          key: editForm.key,
          labelAr: editForm.labelAr,
          isMandatory: editForm.isMandatory,
          authority: editForm.authority || null,
          platformUrl: editForm.platformUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر حفظ التعديل.");
        return;
      }

      toast.success("تم حفظ التعديل");
      setEditingId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteStage(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/case-flows/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر حذف المرحلة.");
        return;
      }

      toast.success("تم حذف المرحلة");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function submitAdd(caseType: CaseType) {
    if (!addForm.order || !addForm.key || !addForm.labelAr) {
      toast.error("الترتيب والمفتاح والاسم حقول مطلوبة");
      return;
    }

    setSaving(true);
    const derivedKey = addForm.key || addForm.labelAr.trim().replace(/\s+/g, "_").toLowerCase();

    try {
      const res = await fetch("/api/case-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseType,
          order: Number(addForm.order),
          key: derivedKey,
          labelAr: addForm.labelAr,
          isMandatory: addForm.isMandatory,
          authority: addForm.authority || null,
          platformUrl: addForm.platformUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر إضافة المرحلة.");
        return;
      }

      toast.success("تمت إضافة المرحلة");
      setAddingFor(null);
      setAddForm(emptyForm);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {CASE_TYPE_ORDER.map((caseType) => {
        const stages = grouped.get(caseType) ?? [];
        return (
          <section key={caseType} className="rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
              <h2 className="font-semibold text-navy">{CASE_TYPE_LABELS_AR[caseType]}</h2>
              <button
                type="button"
                onClick={() => {
                  setAddingFor(caseType);
                  setAddForm({ ...emptyForm, order: String(stages.length + 1) });
                }}
                className="text-sm text-gold hover:underline"
              >
                + إضافة مرحلة
              </button>
            </div>

            {stages.length === 0 && addingFor !== caseType ? (
              <p className="px-5 py-4 text-sm text-foreground/50">
                لا مراحل معرّفة — يُعرض شريط مسار افتراضي (المحكمة مباشرة).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-xs text-foreground/50">
                      <th className="px-4 py-2 font-medium">الترتيب</th>
                      <th className="px-4 py-2 font-medium">الاسم</th>
                      <th className="px-4 py-2 font-medium">إلزامية</th>
                      <th className="px-4 py-2 font-medium">الجهة</th>
                      <th className="px-4 py-2 font-medium">الرابط</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map((stage) =>
                      editingId === stage.id ? (
                        <tr key={stage.id} className="border-b border-black/5 bg-gold/5">
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={editForm.order}
                              onChange={(e) => setEditForm((f) => ({ ...f, order: e.target.value }))}
                              className="w-16 rounded border border-black/10 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={editForm.labelAr}
                              onChange={(e) => setEditForm((f) => ({ ...f, labelAr: e.target.value }))}
                              className="w-full min-w-[180px] rounded border border-black/10 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={editForm.isMandatory}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, isMandatory: e.target.checked }))
                              }
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={editForm.authority}
                              onChange={(e) => setEditForm((f) => ({ ...f, authority: e.target.value }))}
                              className="w-full min-w-[160px] rounded border border-black/10 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={editForm.platformUrl}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, platformUrl: e.target.value }))
                              }
                              dir="ltr"
                              className="w-full min-w-[160px] rounded border border-black/10 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => saveEdit(stage.id)}
                              className="ml-2 rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-light"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded border border-black/10 px-2.5 py-1 text-xs font-medium text-navy hover:bg-black/5"
                            >
                              إلغاء
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={stage.id} className="border-b border-black/5 last:border-0">
                          <td className="px-4 py-2 text-navy">{stage.order}</td>
                          <td className="px-4 py-2 font-medium text-navy">{stage.labelAr}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                stage.isMandatory
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {stage.isMandatory ? "إلزامية" : "اختيارية"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-foreground/70">{stage.authority ?? "—"}</td>
                          <td className="px-4 py-2 text-foreground/50" dir="ltr">
                            {stage.platformUrl ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2">
                            <button
                              type="button"
                              onClick={() => startEdit(stage)}
                              className="ml-2 text-xs font-medium text-taradhi hover:underline"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => deleteStage(stage.id)}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              حذف
                            </button>
                          </td>
                        </tr>
                      )
                    )}

                    {addingFor === caseType && (
                      <tr className="border-b border-black/5 bg-emerald-50">
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={addForm.order}
                            onChange={(e) => setAddForm((f) => ({ ...f, order: e.target.value }))}
                            className="w-16 rounded border border-black/10 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            placeholder="اسم المرحلة"
                            value={addForm.labelAr}
                            onChange={(e) => setAddForm((f) => ({ ...f, labelAr: e.target.value }))}
                            className="w-full min-w-[180px] rounded border border-black/10 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={addForm.isMandatory}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, isMandatory: e.target.checked }))
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            placeholder="الجهة (اختياري)"
                            value={addForm.authority}
                            onChange={(e) => setAddForm((f) => ({ ...f, authority: e.target.value }))}
                            className="w-full min-w-[160px] rounded border border-black/10 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            placeholder="الرابط (اختياري)"
                            value={addForm.platformUrl}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, platformUrl: e.target.value }))
                            }
                            dir="ltr"
                            className="w-full min-w-[160px] rounded border border-black/10 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => submitAdd(caseType)}
                            className="ml-2 rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-light"
                          >
                            إضافة
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingFor(null)}
                            className="rounded border border-black/10 px-2.5 py-1 text-xs font-medium text-navy hover:bg-black/5"
                          >
                            إلغاء
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
