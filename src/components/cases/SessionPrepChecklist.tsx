"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { PrepTaskType } from "@prisma/client";
import { isCriticalPrepTask, prepProgress } from "@/lib/sessionPrep";
import { formatDualDateTime } from "@/lib/dateUtils";

export type PrepTask = {
  id: string;
  taskType: PrepTaskType;
  title: string;
  description: string;
  isCompleted: boolean;
  completedByName: string | null;
  completedAt: string | null;
  notes: string | null;
};

export function SessionPrepChecklist({
  sessionId,
  sessionDate,
  tasks,
  canEdit,
}: {
  sessionId: string;
  sessionDate: string;
  tasks: PrepTask[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  const progress = prepProgress(tasks);
  const pendingCritical = tasks.filter((t) => !t.isCompleted && isCriticalPrepTask(t.taskType));
  const hoursLeft = (new Date(sessionDate).getTime() - Date.now()) / 3600000;
  const urgent = hoursLeft <= 24 && hoursLeft >= 0;

  async function toggle(task: PrepTask) {
    setBusy(task.id);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/prep/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !task.isCompleted }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "تعذّر التحديث.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`rounded-xl border-2 p-5 shadow-sm ${urgent && progress < 100 ? "border-red-300 bg-red-50" : "border-black/5 bg-white"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-navy">📋 تحضير الجلسة — {formatDualDateTime(sessionDate)}</h2>
        <span className={`text-sm font-semibold ${progress === 100 ? "text-emerald-700" : urgent ? "text-red-700" : "text-navy"}`}>
          {progress}%
        </span>
      </div>

      {/* شريط التقدّم */}
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className={`h-full transition-all ${progress === 100 ? "bg-emerald-500" : urgent ? "bg-red-500" : "bg-taradhi"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* تحذير العناصر الحرجة */}
      {pendingCritical.length > 0 && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-100 px-4 py-2.5 text-sm font-medium text-red-800">
          🚨 عنصر حرج غير جاهز: {pendingCritical.map((t) => t.title).join("، ")}
        </div>
      )}

      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className={`rounded-lg border px-4 py-2.5 ${t.isCompleted ? "border-emerald-200 bg-emerald-50/50" : isCriticalPrepTask(t.taskType) ? "border-red-200" : "border-black/5"}`}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={t.isCompleted}
                disabled={!canEdit || busy === t.id}
                onChange={() => toggle(t)}
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${t.isCompleted ? "text-emerald-800 line-through" : "text-navy"}`}>
                  {t.title}
                  {isCriticalPrepTask(t.taskType) && <span className="mr-1 text-xs font-normal text-red-600">(حرج)</span>}
                </span>
                <span className="mt-0.5 block text-xs text-foreground/60">{t.description}</span>
                {t.isCompleted && t.completedByName && (
                  <span className="mt-1 block text-xs text-emerald-700">
                    ✓ {t.completedByName}
                    {t.completedAt ? ` — ${formatDualDateTime(t.completedAt)}` : ""}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
