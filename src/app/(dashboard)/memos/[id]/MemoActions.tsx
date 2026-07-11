"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { MemoStatus } from "@prisma/client";

export function MemoActions({
  memoId,
  status,
  canReview,
}: {
  memoId: string;
  status: MemoStatus;
  canReview: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState("");

  async function review(action: "approve" | "request_changes") {
    if (action === "request_changes" && !comments.trim()) {
      toast.error("ملاحظات التعديل إلزامية");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/memos/${memoId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comments }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تنفيذ المراجعة.");
        return;
      }
      toast.success(action === "approve" ? "تم اعتماد المذكرة" : "تم طلب التعديلات");
      setComments("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function courtSubmit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/memos/${memoId}/court-submit`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تحديث الحالة.");
        return;
      }
      toast.success("تم تحديد المذكرة كمُقدَّمة للمحكمة");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!canReview) return null;

  if (status === "submitted") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-navy">مراجعة المذكرة</h2>
        <label className="mb-1.5 block text-sm font-medium text-navy">ملاحظات المراجعة</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          placeholder="اكتب ملاحظاتك (إلزامية عند طلب تعديلات)..."
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <div className="mt-3 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => review("request_changes")}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            طلب تعديلات
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => review("approve")}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            اعتماد المذكرة
          </button>
        </div>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-emerald-800">المذكرة معتمدة وجاهزة للتقديم.</p>
          <button
            type="button"
            disabled={loading}
            onClick={courtSubmit}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            تحديد كمُقدَّمة للمحكمة
          </button>
        </div>
      </div>
    );
  }

  return null;
}
