"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { ServicePriority, ServiceType } from "@prisma/client";
import { SERVICE_PRIORITY_LABELS_AR, SERVICE_TYPE_LABELS_AR } from "@/lib/services";

type Opt = { id: string; fullName: string };
const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function NewServiceModal({
  clients,
  users,
  onClose,
}: {
  clients: Opt[];
  users: Opt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadLawyerId, setLeadLawyerId] = useState("");
  const [coLawyerIds, setCoLawyerIds] = useState<string[]>([]);

  function toggleCo(uid: string) {
    setCoLawyerIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string)?.trim();
    if (!title) {
      setError("عنوان الدراسة مطلوب");
      return;
    }
    if (!leadLawyerId) {
      setError("المحامي الرئيسي مطلوب");
      return;
    }
    const payload = {
      title,
      serviceType: fd.get("serviceType") as ServiceType,
      clientId: (fd.get("clientId") as string) || null,
      description: fd.get("description"),
      leadLawyerId,
      coLawyerIds: coLawyerIds.filter((x) => x !== leadLawyerId),
      priority: fd.get("priority") as ServicePriority,
      fee: fd.get("fee") || null,
      dueDate: fd.get("dueDate") || null,
    };
    setLoading(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر إنشاء الدراسة.");
        return;
      }
      toast.success(`تم إنشاء الدراسة ${data.serviceNumber}`);
      router.push(`/services/${data.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // المشاركون المتاحون = كل المستخدمين عدا المحامي الرئيسي المختار.
  const coOptions = users.filter((u) => u.id !== leadLawyerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-amiri text-xl font-bold text-navy">دراسة قانونية جديدة</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div>
            <label className={labelClass}>عنوان الدراسة <span className="text-red-600">*</span></label>
            <input name="title" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>نوع الدراسة</label>
              <select name="serviceType" defaultValue="legal_consultation" className={inputClass}>
                {Object.entries(SERVICE_TYPE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>الأولوية</label>
              <select name="priority" defaultValue="normal" className={inputClass}>
                {Object.entries(SERVICE_PRIORITY_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>العميل <span className="text-xs font-normal text-foreground/50">(اختياري)</span></label>
              <select name="clientId" defaultValue="" className={inputClass}>
                <option value="">بدون عميل</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
            </div>
          </div>

          {/* الفريق: محامٍ رئيسي + مشاركون */}
          <div>
            <label className={labelClass}>المحامي الرئيسي <span className="text-red-600">*</span></label>
            <select
              value={leadLawyerId}
              onChange={(e) => setLeadLawyerId(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>اختر المحامي الرئيسي</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              المحامون المشاركون{" "}
              <span className="text-xs font-normal text-foreground/50">(اختياري — {coLawyerIds.filter((x) => x !== leadLawyerId).length} مختار)</span>
            </label>
            {coOptions.length === 0 ? (
              <p className="rounded-lg border border-black/10 px-3 py-2 text-xs text-foreground/50">لا يوجد محامون آخرون متاحون</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-black/10 p-2">
                {coOptions.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-black/5">
                    <input type="checkbox" checked={coLawyerIds.includes(u.id)} onChange={() => toggleCo(u.id)} />
                    <span>{u.fullName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>الأتعاب (ريال)</label>
              <input name="fee" type="number" step="0.01" className={inputClass} dir="ltr" />
            </div>
            <div>
              <label className={labelClass}>تاريخ الاستحقاق</label>
              <input name="dueDate" type="date" className={inputClass} dir="ltr" />
            </div>
          </div>
          <div>
            <label className={labelClass}>الوصف</label>
            <textarea name="description" rows={3} className={inputClass} />
          </div>
          </div>

          <div className="shrink-0 border-t border-black/5 px-6 py-4">
            {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
              <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
                {loading ? "جارٍ الحفظ..." : "إنشاء الدراسة"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
