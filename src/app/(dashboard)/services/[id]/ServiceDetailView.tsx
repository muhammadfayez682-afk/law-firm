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
  client: { id: string; fullName: string } | null;
  assignedTo: { fullName: string };
  lead: { id: string; fullName: string };
  coMembers: { id: string; fullName: string }[];
  createdBy: { fullName: string };
  notes: { id: string; content: string; authorName: string; createdAt: string }[];
  documents: { id: string; title: string; uploadedByName: string }[];
};

const STATUS_OPTIONS: ServiceStatus[] = ["new", "in_progress", "pending_client", "under_review", "completed", "cancelled"];
const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

type Opt = { id: string; fullName: string };

export function ServiceDetailView({
  service,
  users,
  canEdit,
  canManageFee,
}: {
  service: ServiceData;
  users: Opt[];
  canEdit: boolean;
  canManageFee: boolean;
}) {
  const router = useRouter();
  const [deliverable, setDeliverable] = useState(service.deliverable ?? "");
  const [fee, setFee] = useState(service.fee != null ? String(service.fee) : "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTeamEdit, setShowTeamEdit] = useState(false);

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
        <Link href="/services" className="text-sm text-gold hover:underline">العودة للدراسات</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info
          label="العميل"
          value={
            service.client ? (
              <Link href={`/clients/${service.client.id}`} className="text-taradhi hover:underline">{service.client.fullName}</Link>
            ) : (
              <span className="text-foreground/50">بدون عميل مرتبط</span>
            )
          }
        />
        <Info label="المحامي الرئيسي" value={service.lead.fullName} />
        <Info label="أنشأها" value={service.createdBy.fullName} />
        <Info label="الاستحقاق" value={service.dueDate ? formatDualDate(service.dueDate) : "—"} />
      </div>

      {/* فريق الدراسة */}
      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy">فريق الدراسة</h2>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowTeamEdit(true)}
              className="rounded-lg border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy/5"
            >
              تعديل الفريق
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3 py-1 text-sm font-medium text-navy">
            <span className="text-xs text-foreground/50">رئيسي</span>
            {service.lead.fullName}
          </span>
          {service.coMembers.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-sm text-navy">
              <span className="text-xs text-foreground/50">مشارك</span>
              {m.fullName}
            </span>
          ))}
          {service.coMembers.length === 0 && (
            <span className="text-sm text-foreground/50">لا يوجد محامون مشاركون</span>
          )}
        </div>
      </section>

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
                <a href={`/api/service-documents/${d.id}/download`} target="_blank" rel="noopener noreferrer" className="text-taradhi hover:underline">{d.title}</a>
                <span className="text-xs text-foreground/50">{d.uploadedByName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showTeamEdit && (
        <TeamEditModal
          serviceId={service.id}
          users={users}
          currentLeadId={service.lead.id}
          currentCoIds={service.coMembers.map((m) => m.id)}
          onClose={() => setShowTeamEdit(false)}
        />
      )}
    </div>
  );
}

function TeamEditModal({
  serviceId,
  users,
  currentLeadId,
  currentCoIds,
  onClose,
}: {
  serviceId: string;
  users: Opt[];
  currentLeadId: string;
  currentCoIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [leadLawyerId, setLeadLawyerId] = useState(currentLeadId);
  const [coLawyerIds, setCoLawyerIds] = useState<string[]>(currentCoIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCo(uid: string) {
    setCoLawyerIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  async function save() {
    if (!leadLawyerId) {
      setError("المحامي الرئيسي مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadLawyerId, coLawyerIds: coLawyerIds.filter((x) => x !== leadLawyerId) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? "تعذّر حفظ الفريق.");
        return;
      }
      toast.success("حُدّث فريق الدراسة");
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const coOptions = users.filter((u) => u.id !== leadLawyerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-amiri text-lg font-bold text-navy">تعديل فريق الدراسة</h2>
          <button type="button" onClick={onClose} className="text-lg text-foreground/40 hover:text-navy">✕</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">المحامي الرئيسي <span className="text-red-600">*</span></label>
            <select value={leadLawyerId} onChange={(e) => setLeadLawyerId(e.target.value)} className={inputClass}>
              <option value="" disabled>اختر المحامي الرئيسي</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">
              المحامون المشاركون{" "}
              <span className="text-xs font-normal text-foreground/50">({coLawyerIds.filter((x) => x !== leadLawyerId).length} مختار)</span>
            </label>
            {coOptions.length === 0 ? (
              <p className="rounded-lg border border-black/10 px-3 py-2 text-xs text-foreground/50">لا يوجد محامون آخرون متاحون</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-black/10 p-2">
                {coOptions.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-black/5">
                    <input type="checkbox" checked={coLawyerIds.includes(u.id)} onChange={() => toggleCo(u.id)} />
                    <span>{u.fullName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-black/5 px-6 py-4">
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {saving ? "جارٍ الحفظ..." : "حفظ الفريق"}
            </button>
          </div>
        </div>
      </div>
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
