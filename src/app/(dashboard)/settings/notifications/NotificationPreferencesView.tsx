"use client";

import { Fragment, useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import {
  NOTIFICATION_META,
  NOTIFICATION_CATEGORY_LABELS_AR,
  getTypesByCategory,
} from "@/lib/notifications/meta";

const CHANNELS: { key: NotificationChannel; label: string; enabled: boolean }[] = [
  { key: "in_app", label: "داخل النظام", enabled: true },
  { key: "email", label: "بريد", enabled: false },
  { key: "sms", label: "SMS", enabled: false },
  { key: "whatsapp", label: "واتساب", enabled: false },
];

const typesByCategory = getTypesByCategory();

export function NotificationPreferencesView() {
  const [prefs, setPrefs] = useState<Record<NotificationType, NotificationChannel[]>>(
    {} as Record<NotificationType, NotificationChannel[]>
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/notifications/preferences", { cache: "no-store" });
      const data = await res.json();
      const map = {} as Record<NotificationType, NotificationChannel[]>;
      for (const p of data.preferences ?? []) map[p.type as NotificationType] = p.channels;
      setPrefs(map);
      setLoading(false);
    })();
  }, []);

  function toggle(type: NotificationType, channel: NotificationChannel) {
    setPrefs((prev) => {
      const current = new Set(prev[type] ?? []);
      if (current.has(channel)) current.delete(channel);
      else current.add(channel);
      return { ...prev, [type]: [...current] };
    });
  }

  function restoreDefault() {
    setPrefs((prev) => {
      const next = { ...prev };
      for (const type of Object.keys(next) as NotificationType[]) next[type] = ["in_app"];
      return next;
    });
    toast("أُعيدت القنوات للافتراضي (داخل النظام) — اضغط حفظ للتأكيد", { icon: "↩️" });
  }

  async function save() {
    setSaving(true);
    try {
      const preferences = (Object.keys(prefs) as NotificationType[]).map((type) => ({
        type,
        channels: prefs[type],
      }));
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      if (res.ok) toast.success("حُفظت تفضيلات الإشعارات");
      else toast.error("تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="px-4 py-12 text-center text-sm text-foreground/50">جارٍ التحميل...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">تفضيلات الإشعارات</h1>
          <p className="text-sm text-foreground/60">اختر قنوات كل نوع من الإشعارات</p>
        </div>
        <div className="flex gap-2">
          <button onClick={restoreDefault} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-black/5">
            استعادة الافتراضي
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-taradhi px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-navy/5 text-xs text-foreground/50">
              <th className="px-4 py-3 font-medium">نوع الإشعار</th>
              {CHANNELS.map((c) => (
                <th key={c.key} className="px-4 py-3 text-center font-medium">
                  {c.label}
                  {!c.enabled && <span className="mr-1 text-[10px] text-foreground/40">(قريبًا)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(typesByCategory) as (keyof typeof typesByCategory)[]).map((cat) => (
              <Fragment key={cat}>
                <tr className="bg-black/[0.02]">
                  <td colSpan={1 + CHANNELS.length} className="px-4 py-2 text-xs font-semibold text-navy">
                    {NOTIFICATION_CATEGORY_LABELS_AR[cat]}
                  </td>
                </tr>
                {typesByCategory[cat].map((type) => (
                  <tr key={type} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-navy">{NOTIFICATION_META[type].label}</p>
                      <p className="text-xs text-foreground/50">{NOTIFICATION_META[type].description}</p>
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          disabled={!c.enabled}
                          checked={(prefs[type] ?? []).includes(c.key)}
                          onChange={() => toggle(type, c.key)}
                          className="disabled:opacity-30"
                          aria-label={`${NOTIFICATION_META[type].label} - ${c.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
