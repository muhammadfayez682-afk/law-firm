"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { TaskCategory, TaskPriority, UserRole } from "@prisma/client";
import {
  TASK_CATEGORY_LABELS_AR,
  TASK_PRIORITY_LABELS_AR,
} from "@/lib/tasks";

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function NewTaskModal({
  users,
  cases = [],
  intakes = [],
  presetCaseId = null,
  presetIntakeId = null,
  currentUserId,
  onClose,
}: {
  users: { id: string; fullName: string; role?: UserRole }[];
  cases?: { id: string; internalNumber: string; title: string }[];
  intakes?: { id: string; requestNumber: string }[];
  presetCaseId?: string | null;
  presetIntakeId?: string | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string)?.trim();
    if (!title) {
      toast.error("عنوان المهمة مطلوب");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: fd.get("description") || null,
          category: fd.get("category"),
          assignedToId: fd.get("assignedToId"),
          priority: fd.get("priority"),
          caseId: presetCaseId ?? fd.get("caseId") ?? null,
          intakeId: presetIntakeId ?? fd.get("intakeId") ?? null,
          dueDate: fd.get("dueDate") || null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(d?.error ?? "تعذّر إنشاء المهمة.");
        return;
      }
      toast.success("تم إنشاء المهمة");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">مهمة جديدة</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>
              عنوان المهمة <span className="text-red-600">*</span>
            </label>
            <input name="title" required className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>الوصف</label>
            <textarea name="description" rows={3} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                الفئة <span className="text-red-600">*</span>
              </label>
              <select name="category" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  اختر الفئة
                </option>
                {Object.entries(TASK_CATEGORY_LABELS_AR).map(([v, l]) => (
                  <option key={v} value={v as TaskCategory}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>الأولوية</label>
              <select name="priority" defaultValue="normal" className={inputClass}>
                {Object.entries(TASK_PRIORITY_LABELS_AR).map(([v, l]) => (
                  <option key={v} value={v as TaskPriority}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              المسند إليه <span className="text-red-600">*</span>
            </label>
            <select name="assignedToId" required defaultValue={currentUserId} className={inputClass}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                  {u.id === currentUserId ? " (أنا)" : ""}
                </option>
              ))}
            </select>
          </div>

          {!presetCaseId && cases.length > 0 && (
            <div>
              <label className={labelClass}>ربط بقضية</label>
              <select name="caseId" defaultValue="" className={inputClass}>
                <option value="">بدون قضية</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.internalNumber} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!presetIntakeId && intakes.length > 0 && (
            <div>
              <label className={labelClass}>ربط بطلب استلام</label>
              <select name="intakeId" defaultValue="" className={inputClass}>
                <option value="">بدون طلب</option>
                {intakes.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.requestNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>تاريخ الاستحقاق</label>
            <input name="dueDate" type="date" className={inputClass} dir="ltr" />
          </div>

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
              {loading ? "جارٍ الإنشاء..." : "إنشاء المهمة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
