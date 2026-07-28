"use client";

import { useState } from "react";
import Link from "next/link";
import type { TaskCategory, TaskPriority, TaskStatus } from "@prisma/client";
import {
  TASK_CATEGORY_LABELS_AR,
  TASK_CATEGORY_STYLES,
  TASK_KANBAN_COLUMNS,
  TASK_PRIORITY_LABELS_AR,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS_AR,
  TASK_STATUS_STYLES,
} from "@/lib/tasks";
import { formatDualDate } from "@/lib/dateUtils";

type TaskRow = {
  id: string;
  taskNumber: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  rawStatus: TaskStatus;
  priority: TaskPriority;
  assignedToName: string;
  assignedByName: string;
  assigneeCount: number;
  dueDate: string | null;
  caseId: string | null;
  caseInternalNumber: string | null;
  intakeRequestNumber: string | null;
};

export function TasksBoard({ tasks }: { tasks: TaskRow[] }) {
  const [view, setView] = useState<"table" | "kanban">("table");

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <ViewToggle current={view} onChange={setView} />
      </div>
      {view === "table" ? <TableView tasks={tasks} /> : <KanbanView tasks={tasks} />}
    </div>
  );
}

function ViewToggle({
  current,
  onChange,
}: {
  current: "table" | "kanban";
  onChange: (v: "table" | "kanban") => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-black/10 text-sm">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={`px-4 py-2 font-medium ${current === "table" ? "bg-navy text-white" : "bg-white text-navy hover:bg-black/5"}`}
      >
        جدول
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={`px-4 py-2 font-medium ${current === "kanban" ? "bg-navy text-white" : "bg-white text-navy hover:bg-black/5"}`}
      >
        كانبان
      </button>
    </div>
  );
}

function DueCell({ dueDate, overdue }: { dueDate: string | null; overdue: boolean }) {
  if (!dueDate) return <span className="text-foreground/40">—</span>;
  return (
    <span className={overdue ? "font-semibold text-red-600" : "text-foreground/70"} dir="ltr">
      {formatDualDate(dueDate)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TASK_PRIORITY_STYLES[priority]}`}>
      {priority === "urgent" ? "⚡ " : ""}
      {TASK_PRIORITY_LABELS_AR[priority]}
    </span>
  );
}

function TableView({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-right text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
              <th className="px-4 py-3">رقم المهمة</th>
              <th className="px-4 py-3">العنوان</th>
              <th className="px-4 py-3">الفئة</th>
              <th className="px-4 py-3">المسند إليه</th>
              <th className="px-4 py-3">المسند من</th>
              <th className="px-4 py-3">الاستحقاق</th>
              <th className="px-4 py-3">الأولوية</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">القضية</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                <td className="px-4 py-3 font-mono text-xs text-foreground/60" dir="ltr">{t.taskNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/tasks/${t.id}`} className="font-medium text-taradhi hover:underline">
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TASK_CATEGORY_STYLES[t.category]}`}>
                    {TASK_CATEGORY_LABELS_AR[t.category]}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground/70">
                  {t.assignedToName}
                  {t.assigneeCount > 1 && (
                    <span className=" mr-1.5 inline-flex items-center rounded-full bg-navy/10 px-1.5 py-0.5 text-[11px] text-navy">
                      👥 {t.assigneeCount}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground/70">{t.assignedByName}</td>
                <td className="px-4 py-3"><DueCell dueDate={t.dueDate} overdue={t.status === "overdue"} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TASK_STATUS_STYLES[t.status]}`}>
                    {TASK_STATUS_LABELS_AR[t.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {t.caseId ? (
                    <Link href={`/cases/${t.caseId}`} className="text-navy hover:underline">
                      {t.caseInternalNumber}
                    </Link>
                  ) : t.intakeRequestNumber ? (
                    <span className="font-mono text-xs text-foreground/50" dir="ltr">{t.intakeRequestNumber}</span>
                  ) : (
                    <span className="text-foreground/40">—</span>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-foreground/50">
                  لا توجد مهام مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KanbanView({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {TASK_KANBAN_COLUMNS.map((col) => {
        // المهام المتأخرة تبقى ضمن عمودها الأصلي (حسب الحالة الفعلية) مع إبراز التأخّر.
        const columnTasks = tasks.filter((t) => t.rawStatus === col.status);
        return (
          <div key={col.status} className="rounded-xl border border-black/5 bg-black/[0.015] p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-navy">{col.label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-foreground/50">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  className="block rounded-lg border border-black/5 bg-white p-3 shadow-sm hover:border-gold/40"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{t.title}</p>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="mb-2 font-mono text-[11px] text-foreground/40" dir="ltr">{t.taskNumber}</p>
                  <div className="flex items-center justify-between text-xs text-foreground/50">
                    <span>
                      {t.assignedToName}
                      {t.assigneeCount > 1 && <span className="mr-1 text-navy">👥 {t.assigneeCount}</span>}
                    </span>
                    {t.status === "overdue" ? (
                      <span className="font-semibold text-red-600">متأخرة</span>
                    ) : t.dueDate ? (
                      <span dir="ltr">{formatDualDate(t.dueDate)}</span>
                    ) : null}
                  </div>
                </Link>
              ))}
              {columnTasks.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-foreground/40">لا توجد مهام</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
