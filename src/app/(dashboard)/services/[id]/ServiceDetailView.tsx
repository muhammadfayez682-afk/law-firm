"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { ServiceStatus, ServiceType, ServicePriority } from "@prisma/client";
import {
  SERVICE_PRIORITY_LABELS_AR,
  SERVICE_STATUS_LABELS_AR,
  SERVICE_STATUS_STYLES,
  SERVICE_TYPE_LABELS_AR,
} from "@/lib/services";
import { formatDualDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/formatNumber";

type ServiceData = {
  id: string;
  serviceNumber: string;
  title: string;
  serviceType: ServiceType;
  description: string;
  status: ServiceStatus;
  priority: ServicePriority;
  fee: number | null;
  deliverable: string | null;
  deliverableNotes: string | null;
  dueDate: string | null;
  client: { id: string; fullName: string };
  assignedTo: { fullName: string };
  createdBy: { fullName: string };
  notes: { id: string; content: string; authorName: string; createdAt: string }[];
  documents: { id: string; title: string; storagePath: string; uploadedByName: string }[];
};

const STATUS_OPTIONS: ServiceStatus[] = ["new", "in_progress", "pending_client", "under_review", "completed", "cancelled"];
const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

export function ServiceDetailView({
  service,
  canEdit,
  canManageFee,
}: {
  service: ServiceData;
  canEdit: boolean;
  canManageFee: boolean;
}) {
  const router = useRouter();
  const [deliverable, setDeliverable] = useState(service.deliverable ?? "");
  const [fee, setFee] = useState(service.fee != null ? String(service.fee) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function patch(body: Record<string, unknown>, msg: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "تعذّر الحفظ.");
        return;
      }
      toast.success(msg);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    const res = await fetch(`/api/services/${service.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: note.trim() }),
    });
    if (res.ok) {
      setNote("");
      toast.success("أُضيفت الملاحظة");
      router.refresh();
    } else toast.error("تعذّر إضافة الملاحظة");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-foreground/50" dir="ltr">{service.serviceNumber}</p>
          <h1 className="font-amiri text-2xl font-bold text-navy">{service.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${SERVICE_STATUS_STYLES[service.status]}`}>
              {SERVICE_STATUS_LABELS_AR[service.status]}
            </span>
            <span className="text-foreground/50">{SERVICE_TYPE_LABELS_AR[service.serviceType]}</span>
            <span className="text-foreground/40">·</span>
            <span className="text-foreground/50">أولوية {SERVICE_PRIORITY_LABELS_AR[service.priority]}</span>
          </div>
        </div>
        <Link href="/services" className="text-sm text-gold hover:underline">العودة للخدمات</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="العميل" value={<Link href={`/clients/${service.client.id}`} className="text-taradhi hover:underline">{service.client.fullName}</Link>} />
        <Info label="المسؤول" value={service.assignedTo.fullName} />
        <Info label="أنشأها" value={service.createdBy.fullName} />
        <Info label="الاستحقاق" value={service.dueDate ? formatDualDate(service.dueDate) : "—"} />
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <span className="text-sm font-medium text-navy">تغيير الحالة:</span>
          <select
            value={service.status}
            disabled={saving}
            onChange={(e) => patch({ status: e.target.value }, "حُدّثت الحالة")}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{SERVICE_STATUS_LABELS_AR[s]}</option>)}
          </select>
        </div>
      )}

      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-semibold text-navy">الوصف</h2>
        <p className="whitespace-pre-wrap text-sm text-foreground/80">{service.description}</p>
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-navy">المخرج (Deliverable)</h2>
        {canEdit ? (
          <>
            <textarea value={deliverable} onChange={(e) => setDeliverable(e.target.value)} rows={5} className={inputClass} placeholder="نص المخرج النهائي للخدمة..." />
            <button onClick={() => patch({ deliverable }, "حُفظ المخرج")} disabled={saving} className="mt-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              حفظ المخرج
            </button>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground/80">{service.deliverable || "—"}</p>
        )}
      </section>

      {(canManageFee || service.fee != null) && (
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">الأتعاب</h2>
          {canManageFee ? (
            <div className="flex flex-wrap items-center gap-2">
              <input value={fee} onChange={(e) => setFee(e.target.value)} type="number" step="0.01" dir="ltr" className="w-40 rounded-lg border border-black/10 px-3 py-2 text-sm" />
              <span className="text-sm text-foreground/50">ريال</span>
              <button onClick={() => patch({ fee: fee || null }, "حُفظت الأتعاب")} disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
                حفظ
              </button>
            </div>
          ) : (
            <p className="text-lg font-bold text-navy">{service.fee != null ? formatCurrency(service.fee) : "—"}</p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-navy">الملاحظات</h2>
        <div className="mb-3 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="أضف ملاحظة..." className={inputClass} />
          <button onClick={addNote} className="shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">إضافة</button>
        </div>
        {service.notes.length === 0 ? (
          <p className="text-sm text-foreground/50">لا توجد ملاحظات</p>
        ) : (
          <ul className="space-y-2">
            {service.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-black/5 px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between text-xs text-foreground/50">
                  <span className="font-medium text-navy">{n.authorName}</span>
                  <span>{formatDualDate(n.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-foreground/80">{n.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-navy">المستندات</h2>
        {service.documents.length === 0 ? (
          <p className="text-sm text-foreground/50">لا توجد مستندات</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {service.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <a href={d.storagePath} target="_blank" rel="noopener noreferrer" className="text-taradhi hover:underline">{d.title}</a>
                <span className="text-xs text-foreground/50">{d.uploadedByName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-navy">{value}</p>
    </div>
  );
}
