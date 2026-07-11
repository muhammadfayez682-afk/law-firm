"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { SessionStatus, SessionType } from "@prisma/client";
import { formatDualDate, getDayNameAr, formatTime } from "@/lib/dateUtils";

export type SessionRow = {
  id: string;
  sessionDate: string;
  sessionType: SessionType;
  status: SessionStatus;
  court: string | null;
  hasMinutes: boolean;
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
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CONFIG[r.status].className}`}
                    >
                      {STATUS_CONFIG[r.status].label}
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
                      <Link
                        href={`/templates/session_report/fill?caseId=${r.caseId}&sessionId=${r.id}`}
                        className="rounded-lg border border-gold/40 px-2.5 py-1 font-medium text-gold hover:bg-gold/10"
                      >
                        تقرير الجلسة
                      </Link>
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/minutes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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
              disabled={loading || !content.trim()}
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
