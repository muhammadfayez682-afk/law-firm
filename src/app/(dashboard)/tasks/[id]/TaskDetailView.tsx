"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import type { TaskCategory, TaskPriority, TaskStatus, UserRole } from "@prisma/client";
import {
  TASK_CATEGORY_LABELS_AR,
  TASK_CATEGORY_STYLES,
  TASK_PRIORITY_LABELS_AR,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS_AR,
  TASK_STATUS_STYLES,
} from "@/lib/tasks";
import { formatDualDate, formatDualDateTime } from "@/lib/dateUtils";

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

type TaskData = {
  id: string;
  taskNumber: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  displayStatus: TaskStatus;
  priority: TaskPriority;
  assignedToId: string;
  assignedToName: string;
  assignedByName: string;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completionNote: string | null;
  caseId: string | null;
  caseInternalNumber: string | null;
  caseTitle: string | null;
  intakeId: string | null;
  intakeRequestNumber: string | null;
  comments: { id: string; content: string; authorName: string; createdAt: string }[];
};

export function TaskDetailView({
  task,
  canChangeStatus,
  canManage,
  assignableUsers,
}: {
  task: TaskData;
  canChangeStatus: boolean;
  canManage: boolean;
  assignableUsers: { id: string; fullName: string; role: UserRole }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const isClosed = task.status === "completed" || task.status === "cancelled";

  async function changeStatus(status: string, completionNote?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, completionNote }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(d?.error ?? "تعذّر تنفيذ العملية.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function cancelTask() {
    if (!confirm("هل تريد إلغاء هذه المهمة؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(d?.error ?? "تعذّر الإلغاء.");
        return;
      }
      toast.success("تم إلغاء المهمة");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-foreground/50" dir="ltr">{task.taskNumber}</p>
          <h1 className="font-amiri text-2xl font-bold text-navy">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TASK_STATUS_STYLES[task.displayStatus]}`}>
              {TASK_STATUS_LABELS_AR[task.displayStatus]}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TASK_PRIORITY_STYLES[task.priority]}`}>
              {TASK_PRIORITY_LABELS_AR[task.priority]}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TASK_CATEGORY_STYLES[task.category]}`}>
              {TASK_CATEGORY_LABELS_AR[task.category]}
            </span>
          </div>
        </div>
        <Link href="/tasks" className="text-sm text-gold hover:underline">العودة للمهام</Link>
      </div>

      {/* الأزرار */}
      <div className="flex flex-wrap gap-3">
        {canChangeStatus && task.status === "pending" && (
          <button type="button" disabled={busy} onClick={() => changeStatus("in_progress")}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            بدء التنفيذ
          </button>
        )}
        {canChangeStatus && task.status === "in_progress" && (
          <button type="button" disabled={busy} onClick={() => setShowComplete(true)}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            إنهاء المهمة
          </button>
        )}
        {canManage && !isClosed && (
          <button type="button" disabled={busy} onClick={() => setShowEdit(true)}
            className="rounded-lg border border-navy/20 px-5 py-2 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-60">
            تعديل
          </button>
        )}
        {canManage && !isClosed && (
          <button type="button" disabled={busy} onClick={cancelTask}
            className="rounded-lg border border-red-300 px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">
            إلغاء المهمة
          </button>
        )}
      </div>

      {/* التفاصيل */}
      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="المسند إليه" value={task.assignedToName} />
          <Field label="المسند من" value={task.assignedByName} />
          <Field label="تاريخ الاستحقاق" value={task.dueDate ? formatDualDate(task.dueDate) : "—"} dir="ltr" />
          {task.startedAt && <Field label="بدأت في" value={formatDualDate(task.startedAt)} dir="ltr" />}
          {task.completedAt && <Field label="أُنجزت في" value={formatDualDate(task.completedAt)} dir="ltr" />}
        </dl>
        {task.description && (
          <div className="mt-4 border-t border-black/5 pt-4">
            <dt className="mb-1 text-xs text-foreground/50">الوصف</dt>
            <dd className="whitespace-pre-wrap text-sm text-foreground/80">{task.description}</dd>
          </div>
        )}
      </section>

      {(task.caseId || task.intakeId) && (
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-navy">مرتبطة بـ</h2>
          {task.caseId ? (
            <Link href={`/cases/${task.caseId}`} className="flex items-center justify-between rounded-lg border border-black/5 px-4 py-3 text-sm hover:bg-navy/5">
              <span className="font-medium text-navy">{task.caseTitle}</span>
              <span className="font-mono text-xs text-foreground/50" dir="ltr">{task.caseInternalNumber}</span>
            </Link>
          ) : task.intakeId ? (
            <Link href={`/intake/${task.intakeId}`} className="flex items-center justify-between rounded-lg border border-black/5 px-4 py-3 text-sm hover:bg-navy/5">
              <span className="font-medium text-navy">طلب استلام</span>
              <span className="font-mono text-xs text-foreground/50" dir="ltr">{task.intakeRequestNumber}</span>
            </Link>
          ) : null}
        </section>
      )}

      {task.status === "completed" && task.completionNote && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-emerald-800">ملخص الإنجاز</h2>
          <p className="whitespace-pre-wrap text-sm text-emerald-800/90">{task.completionNote}</p>
        </section>
      )}

      <CommentsSection taskId={task.id} comments={task.comments} />

      {showComplete && (
        <CompleteModal
          busy={busy}
          onClose={() => setShowComplete(false)}
          onConfirm={async (note) => {
            const ok = await changeStatus("completed", note);
            if (ok) {
              toast.success("تم إنجاز المهمة");
              setShowComplete(false);
            }
          }}
        />
      )}
      {showEdit && (
        <EditModal task={task} users={assignableUsers} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}

function Field({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div>
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="mt-0.5 text-foreground/80" dir={dir}>{value}</dd>
    </div>
  );
}

function CommentsSection({
  taskId,
  comments,
}: {
  taskId: string;
  comments: TaskData["comments"];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function addComment() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "تعذّر إضافة الملاحظة.");
        return;
      }
      setContent("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-navy">الملاحظات</h2>
      <div className="mb-3 flex gap-2">
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="أضف ملاحظة..." className={inputClass} />
        <button type="button" onClick={addComment} disabled={saving || !content.trim()} className="shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
          إضافة
        </button>
      </div>
      {comments.length === 0 ? (
        <p className="text-sm text-foreground/50">لا توجد ملاحظات</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-black/5 p-3 text-sm">
              <p className="text-foreground/80">{c.content}</p>
              <p className="mt-1 text-xs text-foreground/40">{c.authorName} · {formatDualDateTime(c.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompleteModal({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <ModalShell title="إنهاء المهمة" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>ملخص الإنجاز <span className="text-red-600">*</span></label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={inputClass} />
        </div>
        <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
          <button type="button" disabled={busy || !note.trim()} onClick={() => onConfirm(note.trim())}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? "جارٍ..." : "تأكيد الإنجاز"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditModal({
  task,
  users,
  onClose,
}: {
  task: TaskData;
  users: { id: string; fullName: string; role: UserRole }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          category: fd.get("category"),
          priority: fd.get("priority"),
          assignedToId: fd.get("assignedToId"),
          dueDate: fd.get("dueDate") || null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(d?.error ?? "تعذّر التعديل.");
        return;
      }
      toast.success("تم تعديل المهمة");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="تعديل المهمة" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>العنوان</label>
          <input name="title" defaultValue={task.title} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>الوصف</label>
          <textarea name="description" defaultValue={task.description ?? ""} rows={3} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>الفئة</label>
            <select name="category" defaultValue={task.category} className={inputClass}>
              {Object.entries(TASK_CATEGORY_LABELS_AR).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>الأولوية</label>
            <select name="priority" defaultValue={task.priority} className={inputClass}>
              {Object.entries(TASK_PRIORITY_LABELS_AR).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>المسند إليه</label>
            <select name="assignedToId" defaultValue={task.assignedToId} className={inputClass}>
              {users.length === 0 && <option value={task.assignedToId}>{task.assignedToName}</option>}
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>تاريخ الاستحقاق</label>
            <input name="dueDate" type="date" defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""} className={inputClass} dir="ltr" />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
            {loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
