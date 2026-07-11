"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { CaseOutcome } from "@prisma/client";
import { ReasonPromptModal } from "@/components/modals/ReasonPromptModal";
import { CASE_OUTCOME_LABELS_AR } from "@/lib/caseClosure";
import { formatDualDate } from "@/lib/dateUtils";

export function ClosedCaseBanner({
  caseId,
  outcome,
  closedDate,
  approvedByName,
  isPartner,
}: {
  caseId: string;
  outcome: CaseOutcome | null;
  closedDate: string | Date | null;
  approvedByName: string | null;
  isPartner: boolean;
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);

  async function handleReopen(reason: string) {
    setProcessing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر إعادة فتح القضية.");
        return;
      }

      toast.success("تم إعادة فتح القضية");
      router.refresh();
      setShowReopenModal(false);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-amiri text-lg font-bold text-emerald-800">قضية مغلقة</h3>
        <span className="rounded-full bg-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-900">
          مغلقة
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-emerald-700/70">النتيجة</dt>
          <dd className="mt-0.5 font-medium text-emerald-900">
            {outcome ? CASE_OUTCOME_LABELS_AR[outcome] : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-emerald-700/70">تاريخ الإغلاق</dt>
          <dd className="mt-0.5 font-medium text-emerald-900">
            {closedDate ? formatDualDate(closedDate) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-emerald-700/70">اعتمد الإغلاق</dt>
          <dd className="mt-0.5 font-medium text-emerald-900">{approvedByName ?? "—"}</dd>
        </div>
      </dl>

      {isPartner && (
        <div className="mt-4 border-t border-emerald-200 pt-4">
          <button
            type="button"
            onClick={() => setShowReopenModal(true)}
            disabled={processing}
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            إعادة فتح القضية
          </button>
        </div>
      )}

      {showReopenModal && (
        <ReasonPromptModal
          title="إعادة فتح القضية"
          label="سبب إعادة الفتح"
          submitLabel="إعادة الفتح"
          submitting={processing}
          submitButtonClassName="bg-navy"
          onSubmit={handleReopen}
          onClose={() => setShowReopenModal(false)}
        />
      )}
    </div>
  );
}
