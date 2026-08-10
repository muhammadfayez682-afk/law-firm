"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { SessionStatus, SessionType } from "@prisma/client";
import { formatDualDate, getDayNameAr, formatTime } from "@/lib/dateUtils";
import { SessionReportModal } from "@/components/cases/SessionReportModal";

export type SessionRow = {
  id: string;
  sessionDate: string;
  sessionType: SessionType;
  status: SessionStatus;
  court: string | null;
  hasMinutes: boolean;
  memoId: string | null;
  caseId: string;
  caseTitle: string;
  caseInternalNumber: string;
  clientName: string;
  lawyerName: string;
};

const SESSION_TYPE_LABELS_AR: Record<SessionType, string> = {
  hearing: "مرافعة",
  initial_listening: "استماع",
  verdict: "نطق حكم",
  arbitration: "تحكيم",
  negotiation_meeting: "تسوية ودية",
};

const STATUS_CONFIG: Record<SessionStatus, { label: string; className: string }> = {
  scheduled: { label: "مجدولة", className: "bg-taradhi/10 text-taradhi" },
  held: { label: "انعقدت", className: "bg-emerald-100 text-emerald-700" },
  postponed: { label: "مؤجلة", className: "bg-amber-100 text-amber-700" },
};

export function SessionsTable({ rows }: { rows: SessionRow[] }) {
  const [minutesFor, setMinutesFor] = useState<SessionRow | null>(null);
  const [postponeFor, setPostponeFor] = useState<SessionRow | null>(null);
  const [reportFor, setReportFor] = useState<SessionRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">الوقت</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">القضية</th>
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">المحكمة / الجهة</th>
                <th className="px-4 py-3">المحامي</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{getDayNameAr(r.sessionDate)}</p>
                    <p className="text-xs text-foreground/50" dir="ltr">
                      {formatDualDate(r.sessionDate)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-foreground/70" dir="ltr">
                    {formatTime(r.sessionDate)}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {SESSION_TYPE_LABELS_AR[r.sessionType]}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/cases/${r.caseId}`} className="text-taradhi hover:underline">
                      {r.caseTitle}
                    </Link>
                    <p className="text-xs text-foreground/40">{r.caseInternalNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{r.clientName}</td>
                  <td className="px-4 py-3 text-foreground/70">{r.court ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground/70">{r.lawyerName}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CONFIG[r.status].className}`}
                      >
                        {STATUS_CONFIG[r.status].label}
                      </span>
                      {r.status === "held" &&
                        (r.memoId ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">📝 موثّقة</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">⚠️ بانتظار المذكرة</span>
                        ))}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setMinutesFor(r)}
                        className="rounded-lg border border-navy/20 px-2.5 py-1 font-medium text-navy hover:bg-navy/5"
                      >
                        {r.hasMinutes ? "تعديل المحضر" : "تسجيل المحضر"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportFor(r)}
                        className="rounded-lg border border-gold/40 px-2.5 py-1 font-medium text-gold hover:bg-gold/10"
                      >
                        تقرير الجلسة
                      </button>
                      {r.status !== "postponed" && (
                        <button
                          type="button"
                          onClick={() => setPostponeFor(r)}
                          className="rounded-lg border border-amber-300 px-2.5 py-1 font-medium text-amber-700 hover:bg-amber-50"
                        >
                          تأجيل
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-foreground/50">
                    لا توجد جلسات مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {minutesFor && (
        <RecordMinutesModal session={minutesFor} onClose={() => setMinutesFor(null)} />
      )}
      {postponeFor && (
        <PostponeModal session={postponeFor} onClose={() => setPostponeFor(null)} />
      )}
      {reportFor && (
        <SessionReportModal sessionId={reportFor.id} onClose={() => setReportFor(null)} />
      )}
    </>
  );
}

function RecordMinutesModal({
  session,
  onClose,
}: {
  session: SessionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [memos, setMemos] = useState<{ id: string; title: string; status: string }[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string>(session.memoId ?? "");

  useEffect(() => {
    let active = true;
    fetch(`/api/memos?caseId=${session.caseId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (active && Array.isArray(d)) setMemos(d.map((m) => ({ id: m.id, title: m.title, status: m.status }))); })
      .catch(() => {});
    return () => { active = false; };
  }, [session.caseId]);

  const hasMemo = Boolean(selectedMemoId || session.memoId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    if (!hasMemo) {
      toast.error("اربط مذكرة أو اكتب مذكرة جديدة قبل حفظ المحضر.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/minutes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, memoId: selectedMemoId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر حفظ المحضر.");
        return;
      }
      toast.success("تم حفظ محضر الجلسة");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">محضر الجلسة</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-foreground/60">{session.caseTitle}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="اكتب وقائع الجلسة، ما تم، والقرارات..."
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
          />
          {/* مذكرة الجلسة الإلزامية */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <label className="mb-1.5 block text-sm font-medium text-navy">
              مذكرة الجلسة <span className="text-red-600">*</span>
            </label>
            <select
              value={selectedMemoId}
              onChange={(e) => setSelectedMemoId(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
            >
              <option value="">— اختر مذكرة موجودة —</option>
              {memos.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
            <a
              href={`/memos/new?caseId=${session.caseId}&sessionId=${session.id}`}
              className="mt-2 inline-block text-xs font-medium text-gold hover:underline"
            >
              ✍️ كتابة مذكرة جديدة مرتبطة بالجلسة
            </a>
            {!hasMemo && (
              <p className="mt-1.5 text-xs text-amber-800">
                لا يمكن إغلاق محضر جلسة منعقدة دون ربط مذكرة (ولو مسودّة).
              </p>
            )}
          </div>
          <p className="text-xs text-foreground/50">
            حفظ المحضر يسجّل الجلسة كـ«انعقدت» تلقائيًا.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim() || !hasMemo}
              title={!hasMemo ? "اربط مذكرة أولًا" : undefined}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
            >
              {loading ? "جارٍ الحفظ..." : "حفظ المحضر"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PostponeModal({
  session,
  onClose,
}: {
  session: SessionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newDate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "postponed", sessionDate: newDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "تعذّر تأجيل الجلسة.");
        return;
      }
      toast.success("تم تأجيل الجلسة للموعد الجديد");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">تأجيل الجلسة</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-foreground/60">{session.caseTitle}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy">الموعد الجديد</label>
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              dir="ltr"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || !newDate}
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {loading ? "جارٍ الحفظ..." : "تأجيل"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
