"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

/** زر «إصدار نسخة معدّلة (مذكرة تكميلية)» — يظهر للمذكرات المعتمدة/المُقدّمة. */
export function SupplementButton({ memoId }: { memoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      const res = await fetch(`/api/memos/${memoId}/supplement`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر إنشاء النسخة المعدّلة.");
        return;
      }
      toast.success("أُنشئت مذكرة تكميلية (مسودة)");
      router.push(`/memos/${data.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-purple-900">
            المذكرات المعتمدة لا تُعدَّل — تُصدَر نسخة معدّلة كمذكرة تكميلية جديدة.
          </p>
          <p className="mt-0.5 text-xs text-purple-700">تعود النسخة الجديدة لدورة الاعتماد كمسودة، وتبقى الأصلية كما هي.</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={create}
          className="shrink-0 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {loading ? "جارٍ الإنشاء..." : "إصدار نسخة معدّلة (مذكرة تكميلية)"}
        </button>
      </div>
    </div>
  );
}
