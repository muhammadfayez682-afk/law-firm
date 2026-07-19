"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangeReason, UserRole } from "@prisma/client";
import { CHANGE_REASON_LABELS_AR } from "@/lib/editPermissions";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import { formatDualDateTime } from "@/lib/dateUtils";
import type { TrackedEntityType } from "@/lib/entityChangeTracker";

type LogRow = {
  id: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  changeReason: ChangeReason;
  reasonNote: string;
  changedAt: string;
  changedBy: { fullName: string; role: UserRole };
};

const REASON_ORDER: ChangeReason[] = [
  "data_entry_error",
  "official_update",
  "client_information_change",
  "legal_correction",
  "system_migration",
  "other",
];

export function EntityChangeLog({
  entityType,
  entityId,
}: {
  entityType: TrackedEntityType;
  entityId: string;
}) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ entityType, entityId });
      if (reason) params.set("reason", reason);
      if (days) {
        const from = new Date(Date.now() - Number(days) * 24 * 3600 * 1000).toISOString();
        params.set("from", from);
      }
      const res = await fetch(`/api/change-log?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      } else {
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, reason, days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-navy">سجل التعديلات</h2>
        <div className="flex flex-wrap gap-2">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs outline-none">
            <option value="">كل الأسباب</option>
            {REASON_ORDER.map((r) => (
              <option key={r} value={r}>{CHANGE_REASON_LABELS_AR[r]}</option>
            ))}
          </select>
          <select value={days} onChange={(e) => setDays(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs outline-none">
            <option value="">كل الفترات</option>
            <option value="7">آخر أسبوع</option>
            <option value="30">آخر 30 يومًا</option>
            <option value="90">آخر 3 أشهر</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-foreground/50">جارٍ التحميل...</p>
      ) : logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground/50">لا توجد تعديلات موثّقة</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="rounded-lg border border-black/5 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2 text-xs text-foreground/60">
                <span>{formatDualDateTime(log.changedAt)}</span>
                <span className="font-medium text-navy">
                  {log.changedBy.fullName}{" "}
                  <span className="text-foreground/50">({ROLE_LABELS_AR[log.changedBy.role]})</span>
                </span>
              </div>
              <p className="text-sm">
                <span className="font-medium text-navy">{log.fieldLabel}:</span>{" "}
                <span className="text-red-600 line-through" dir="auto">{log.oldValue ?? "—"}</span>{" "}
                <span className="text-foreground/40">←</span>{" "}
                <span className="font-medium text-emerald-700" dir="auto">{log.newValue ?? "—"}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-start gap-2 text-xs">
                <span className="shrink-0 rounded-full bg-navy/5 px-2 py-0.5 text-navy">
                  {CHANGE_REASON_LABELS_AR[log.changeReason]}
                </span>
                <span className="text-foreground/60">«{log.reasonNote}»</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
