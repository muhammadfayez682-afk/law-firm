"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Results = {
  sessionReminders: number;
  agencyAlerts: number;
  settlementAlerts: number;
  taskAlerts: number;
  invoiceAlerts: number;
  pendingAgencyAlerts: number;
  prepChecklistsCreated: number;
  sessionPrepAlerts: number;
};

const LABELS: Record<keyof Results, string> = {
  sessionReminders: "تذكيرات الجلسات",
  agencyAlerts: "تنبيهات انتهاء الوكالات",
  settlementAlerts: "تنبيهات مهل التسوية",
  taskAlerts: "تنبيهات المهام",
  invoiceAlerts: "تنبيهات الفواتير",
  pendingAgencyAlerts: "تنبيهات قضايا قيد إصدار الوكالة",
  prepChecklistsCreated: "قوائم تحضير جلسات أُنشئت",
  sessionPrepAlerts: "تنبيهات تحضير الجلسات",
};

export function TriggerRemindersButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ total: number; results: Results } | null>(null);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/cron/notifications", { cache: "no-store" });
      if (!res.ok) {
        toast.error("تعذّر تشغيل الفحص");
        return;
      }
      const data = await res.json();
      setResult({ total: data.total, results: data.results });
      toast.success(`أُنشئ ${data.total} إشعار`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={run}
        disabled={running}
        className="w-full rounded-2xl bg-taradhi px-6 py-8 text-lg font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
      >
        {running ? "جارٍ الفحص..." : "🔔 تشغيل فحص التذكيرات الآن"}
      </button>

      {result && (
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="mb-3 font-semibold text-navy">
            النتيجة: {result.total} إشعار جديد
          </p>
          <ul className="space-y-1.5 text-sm">
            {(Object.keys(LABELS) as (keyof Results)[]).map((k) => (
              <li key={k} className="flex items-center justify-between">
                <span className="text-foreground/70">{LABELS[k]}</span>
                <span className="font-mono font-semibold text-navy" dir="ltr">
                  {result.results[k]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
