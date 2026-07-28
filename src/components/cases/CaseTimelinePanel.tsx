"use client";

// التسلسل الزمني لأحداث القضية — عرض عمودي RTL + تعديل/إضافة/حذف (لمن يملك manage_timeline).
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { TimelineEventSource } from "@prisma/client";
import { formatDualDate } from "@/lib/dateUtils";

export type TimelineEventView = {
  id: string;
  sequence: number;
  title: string;
  content: string | null;
  eventDate: string | null;
  source: TimelineEventSource;
  createdByName: string;
};

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";

export function CaseTimelinePanel({
  caseId,
  events,
  canManage,
}: {
  caseId: string;
  events: TimelineEventView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TimelineEventView | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove(ev: TimelineEventView) {
    if (!confirm(`حذف الإجراء «${ev.title}»؟`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/timeline/${ev.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => null);
      if (!res.ok) return toast.error(d?.error ?? "تعذّر الحذف");
      toast.success("حُذف الإجراء");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-navy">🗓️ التسلسل الزمني للقضية</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-navy/20 px-3 py-1 text-xs font-medium text-navy hover:bg-navy/5"
          >
            ➕ إضافة إجراء
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-foreground/50">لا توجد أحداث بعد</p>
      ) : (
        <ol className="relative space-y-4 border-r-2 border-black/10 pr-5">
          {events.map((ev) => {
            const isComplete = !!ev.content && !!ev.eventDate;
            return (
              <li key={ev.id} className="relative">
                {/* نقطة التسلسل على الخط */}
                <span
                  className={`absolute -right-[26px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    isComplete ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {ev.sequence}
                </span>
                <div
                  className={`rounded-lg border p-3 ${
                    isComplete ? "border-emerald-200 bg-emerald-50/40" : "border-black/5 bg-black/[0.02]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${isComplete ? "text-navy" : "text-foreground/60"}`}>
                      {ev.title}
                      {ev.source === "template" && (
                        <span className="mr-1.5 rounded bg-navy/5 px-1.5 py-0.5 text-[10px] text-foreground/50">قالب</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className={isComplete ? "text-emerald-700" : "text-foreground/40"} dir="ltr">
                        {ev.eventDate ? formatDualDate(ev.eventDate) : "لم يُحدد"}
                      </span>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing(ev)}
                            className="text-navy/60 hover:text-navy"
                            title="تعديل"
                          >
                            ✎
                          </button>
                          {ev.source === "manual" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => remove(ev)}
                              className="text-red-500/70 hover:text-red-700"
                              title="حذف"
                            >
                              ✕
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  {ev.content ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-xs text-foreground/70">{ev.content}</p>
                  ) : (
                    <p className="mt-1.5 text-xs text-foreground/40">بانتظار الإدخال</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <EventModal
          caseId={caseId}
          event={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && <EventModal caseId={caseId} event={null} onClose={() => setAdding(false)} />}
    </section>
  );
}

function EventModal({
  caseId,
  event,
  onClose,
}: {
  caseId: string;
  event: TimelineEventView | null; // null = إضافة
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? "");
  const [content, setContent] = useState(event?.content ?? "");
  const [eventDate, setEventDate] = useState(event?.eventDate ? event.eventDate.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const isEdit = event != null;

  async function save() {
    if (!title.trim()) return toast.error("العنوان مطلوب");
    setBusy(true);
    try {
      const url = isEdit ? `/api/cases/${caseId}/timeline/${event!.id}` : `/api/cases/${caseId}/timeline`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() || null, eventDate: eventDate || null }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return toast.error(d?.error ?? "تعذّر الحفظ");
      toast.success(isEdit ? "حُدّث الحدث" : "أُضيف الإجراء");
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-lg font-bold text-navy">{isEdit ? "تعديل حدث" : "إضافة إجراء"}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">العنوان <span className="text-red-600">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">المحتوى</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">التاريخ</label>
            <input type="date" dir="ltr" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
            <button type="button" disabled={busy || !title.trim()} onClick={save}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {busy ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
