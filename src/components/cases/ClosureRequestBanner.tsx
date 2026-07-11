"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ReasonPromptModal } from "@/components/modals/ReasonPromptModal";
import { CASE_OUTCOME_LABELS_AR, CLOSURE_REASON_LABELS_AR } from "@/lib/caseClosure";
import { formatDualDateTime } from "@/lib/dateUtils";

type ClosureRequestInfo = {
  outcome: keyof typeof CASE_OUTCOME_LABELS_AR;
  closureReason: keyof typeof CLOSURE_REASON_LABELS_AR;
  closureNotes: string;
  requestedAt: string | Date;
  requestedBy: { fullName: string };
};

export function ClosureRequestBanner({
  caseId,
  closureRequest,
  isPartner,
}: {
  caseId: string;
  closureRequest: ClosureRequestInfo;
  isPartner: boolean;
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  async function handleApprove() {
    setProcessing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/closure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر اعتماد الإغلاق.");
        return;
      }

      toast.success("تم اعتماد إغلاق القضية");
      router.refresh();
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(rejectionNote: string) {
    setProcessing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/closure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionNote }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر رفض طلب الإغلاق.");
        return;
      }

      toast.success("تم رفض طلب الإغلاق");
      router.refresh();
      setShowRejectModal(false);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-amiri text-lg font-bold text-amber-800">قيد اعتماد الإغلاق</h3>
        <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-medium text-amber-900">
          بانتظار الشريك
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-amber-700/70">طلب الإغلاق</dt>
          <dd className="mt-0.5 font-medium text-amber-900">
            {closureRequest.requestedBy.fullName} — {formatDualDateTime(closureRequest.requestedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700/70">نتيجة القضية</dt>
          <dd className="mt-0.5 font-medium text-amber-900">
            {CASE_OUTCOME_LABELS_AR[closureRequest.outcome]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-amber-700/70">سبب الإغلاق</dt>
          <dd className="mt-0.5 font-medium text-amber-900">
            {CLOSURE_REASON_LABELS_AR[closureRequest.closureReason]}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-amber-700/70">ملخص النتيجة</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-amber-900">{closureRequest.closureNotes}</dd>
        </div>
      </dl>

      {isPartner && (
        <div className="mt-4 flex gap-2 border-t border-amber-200 pt-4">
          <button
            type="button"
            onClick={handleApprove}
            disabled={processing}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            اعتماد الإغلاق
          </button>
          <button
            type="button"
            onClick={() => setShowRejectModal(true)}
            disabled={processing}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            رفض
          </button>
        </div>
      )}

      {showRejectModal && (
        <ReasonPromptModal
          title="رفض طلب الإغلاق"
          label="سبب الرفض"
          submitLabel="رفض الطلب"
          submitting={processing}
          onSubmit={handleReject}
          onClose={() => setShowRejectModal(false)}
        />
      )}
    </div>
  );
}
