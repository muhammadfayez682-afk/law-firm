"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ARCHIVE_REASON_OPTIONS } from "@/lib/caseArchive";
import { formatDualDate } from "@/lib/dateUtils";

export type ArchiveInfo = {
  isArchived: boolean;
  archivedAt: string | null;
  archiveReason: string | null;
  canArchive: boolean;
  canRestore: boolean;
  delete: { allowed: boolean; reason?: string };
};

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

export function CaseArchiveActions({
  caseId,
  title,
  internalNumber,
  info,
}: {
  caseId: string;
  title: string;
  internalNumber: string;
  info: ArchiveInfo;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "archive" | "restore" | "delete">(null);

  // حقول المودالات
  const [archiveReason, setArchiveReason] = useState<string>(ARCHIVE_REASON_OPTIONS[0]);
  const [archiveNote, setArchiveNote] = useState("");
  const [restoreReason, setRestoreReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  async function doArchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: archiveReason, note: archiveNote || null }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return toast.error(d?.error ?? "تعذّرت الأرشفة.");
      toast.success("أُرشفت القضية");
      setModal(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function doRestore() {
    if (!restoreReason.trim()) return toast.error("سبب الاسترجاع مطلوب");
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: restoreReason.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return toast.error(d?.error ?? "تعذّر الاسترجاع.");
      toast.success("أُعيدت القضية من الأرشيف");
      setModal(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/permanent-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmText, reason: deleteReason }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return toast.error(d?.message ?? d?.error ?? "تعذّر الحذف.");
      toast.success("حُذفت القضية نهائيًا");
      setModal(null);
      router.push("/cases");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* بانر القضية المؤرشفة */}
      {info.isArchived && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-300 bg-gray-100 p-5">
          <div>
            <p className="font-semibold text-gray-700">
              🗄️ قضية مؤرشفة{info.archivedAt ? ` منذ ${formatDualDate(info.archivedAt)}` : ""}
            </p>
            {info.archiveReason && <p className="mt-1 text-sm text-gray-600">السبب: {info.archiveReason}</p>}
          </div>
          <div className="flex gap-2">
            {info.canRestore && (
              <button type="button" onClick={() => setModal("restore")} className="rounded-lg border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5">
                استرجاع القضية
              </button>
            )}
            {info.delete.allowed && (
              <button type="button" onClick={() => setModal("delete")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                🗑️ حذف نهائي
              </button>
            )}
          </div>
        </div>
      )}

      {/* زر الأرشفة للقضايا المنتهية */}
      {!info.isArchived && info.canArchive && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setModal("archive")} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            🗄️ أرشفة القضية
          </button>
        </div>
      )}

      {/* مودال الأرشفة */}
      {modal === "archive" && (
        <Shell title={`أرشفة القضية: ${title}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy">سبب الأرشفة <span className="text-red-600">*</span></label>
              <select value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} className={inputClass}>
                {ARCHIVE_REASON_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy">ملاحظة (اختياري)</label>
              <textarea value={archiveNote} onChange={(e) => setArchiveNote(e.target.value)} rows={3} className={inputClass} />
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ستختفي القضية من القوائم النشطة لكن تبقى في السجل. يمكن استرجاعها من «القضايا المؤرشفة».
            </p>
            <Actions busy={busy} onClose={() => setModal(null)} onConfirm={doArchive} confirmLabel="أرشفة" />
          </div>
        </Shell>
      )}

      {/* مودال الاسترجاع */}
      {modal === "restore" && (
        <Shell title="استرجاع القضية" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy">سبب الاسترجاع <span className="text-red-600">*</span></label>
              <textarea value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)} rows={3} className={inputClass} />
            </div>
            <Actions busy={busy} onClose={() => setModal(null)} onConfirm={doRestore} confirmLabel="استرجاع" />
          </div>
        </Shell>
      )}

      {/* مودال الحذف النهائي الصارم */}
      {modal === "delete" && (
        <Shell title="⚠️ حذف نهائي — لا يمكن التراجع!" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">ستُحذف: {title} ({internalNumber})</p>
              <p className="mt-1 text-xs">سيُحذف نهائيًا كل المستندات والمذكرات والجلسات والفواتير والسجلات المرتبطة. هذا الإجراء موثّق ولا يُلغى.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy">اكتب «حذف نهائي» للتأكيد:</label>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={inputClass} dir="rtl" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy">سبب الحذف (إلزامي، 50 حرفًا على الأقل):</label>
              <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={3} className={inputClass} />
              <p className={`mt-1 text-xs ${deleteReason.trim().length >= 50 ? "text-emerald-600" : "text-foreground/50"}`}>{deleteReason.trim().length} / 50</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
              <button
                type="button"
                disabled={busy || confirmText !== "حذف نهائي" || deleteReason.trim().length < 50}
                onClick={doDelete}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "جارٍ الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </div>
        </Shell>
      )}
    </>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-lg font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Actions({ busy, onClose, onConfirm, confirmLabel }: { busy: boolean; onClose: () => void; onConfirm: () => void; confirmLabel: string }) {
  return (
    <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
      <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
      <button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
        {busy ? "جارٍ..." : confirmLabel}
      </button>
    </div>
  );
}
