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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get("title"),
      serviceType: fd.get("serviceType") as ServiceType,
      clientId: fd.get("clientId"),
      description: fd.get("description"),
      assignedToId: fd.get("assignedToId"),
      priority: fd.get("priority") as ServicePriority,
      fee: fd.get("fee") || null,
      dueDate: fd.get("dueDate") || null,
    };
    if (!payload.title || !payload.clientId || !payload.assignedToId) {
      setError("العنوان والعميل والمسؤول حقول مطلوبة");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "تعذّر إنشاء الخدمة.");
        return;
      }
      toast.success(`تم إنشاء الخدمة ${data.serviceNumber}`);
      router.push(`/services/${data.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">خدمة قانونية جديدة</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>عنوان الخدمة <span className="text-red-600">*</span></label>
            <input name="title" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>نوع الخدمة</label>
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
            <div>
              <label className={labelClass}>العميل <span className="text-red-600">*</span></label>
              <select name="clientId" defaultValue="" className={inputClass}>
                <option value="" disabled>اختر العميل</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>المسؤول <span className="text-red-600">*</span></label>
              <select name="assignedToId" defaultValue="" className={inputClass}>
                <option value="" disabled>اختر المسؤول</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
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

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {loading ? "جارٍ الحفظ..." : "إنشاء الخدمة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
