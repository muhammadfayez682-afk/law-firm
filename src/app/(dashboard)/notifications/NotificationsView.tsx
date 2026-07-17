"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { NotificationPriority, NotificationType } from "@prisma/client";
import {
  NOTIFICATION_META,
  NOTIFICATION_CATEGORY_LABELS_AR,
  getTypesByCategory,
} from "@/lib/notifications/meta";
import { relativeTimeAr } from "@/lib/relativeTime";

type NotificationItem = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

const PRIORITY_BORDER: Record<NotificationPriority, string> = {
  urgent: "border-r-4 border-r-red-500",
  high: "border-r-4 border-r-orange-400",
  normal: "border-r-4 border-r-transparent",
  low: "border-r-4 border-r-transparent",
};

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  urgent: "عاجل",
  high: "مهم",
  normal: "عادي",
  low: "منخفض",
};

const typesByCategory = getTypesByCategory();

function dayKey(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export function NotificationsView() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupByDay, setGroupByDay] = useState(false);

  const [status, setStatus] = useState("all");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [days, setDays] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), status });
      if (type) params.set("type", type);
      if (priority) params.set("priority", priority);
      if (days) params.set("days", days);
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setItems(data.notifications ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [page, status, type, priority, days]);

  useEffect(() => {
    load();
  }, [load]);

  // إعادة الصفحة للأولى عند تغيير أي فلتر.
  useEffect(() => {
    setPage(1);
  }, [status, type, priority, days]);

  async function handleClick(n: NotificationItem) {
    if (!n.isRead) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, isRead: true } : it)));
    }
    if (n.actionUrl) router.push(n.actionUrl);
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    toast.success("تم تحديد الكل كمقروء");
    load();
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    await Promise.all(
      [...selected].map((id) => fetch(`/api/notifications/${id}`, { method: "DELETE" }))
    );
    toast.success(`حُذف ${selected.size} إشعار`);
    load();
  }

  async function deleteOld() {
    const res = await fetch("/api/notifications/delete-old", { method: "POST" });
    const data = await res.json();
    toast.success(`حُذف ${data.deleted ?? 0} إشعار مقروء قديم`);
    load();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const grouped = groupByDay
    ? items.reduce<Record<string, NotificationItem[]>>((acc, n) => {
        (acc[dayKey(n.createdAt)] ??= []).push(n);
        return acc;
      }, {})
    : null;

  function renderRow(n: NotificationItem) {
    return (
      <div
        key={n.id}
        className={`flex items-start gap-3 px-4 py-3 ${PRIORITY_BORDER[n.priority]} ${n.isRead ? "bg-white" : "bg-blue-50/40"}`}
      >
        <input
          type="checkbox"
          checked={selected.has(n.id)}
          onChange={() => toggleSelect(n.id)}
          className="mt-1.5"
          aria-label="تحديد"
        />
        <span className="mt-0.5 text-lg leading-none">{NOTIFICATION_META[n.type]?.icon ?? "🔔"}</span>
        <button type="button" onClick={() => handleClick(n)} className="min-w-0 flex-1 text-right">
          <span className="flex items-center gap-1.5">
            {!n.isRead && <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
            <span className="truncate font-semibold text-navy">{n.title}</span>
            <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-foreground/60">
              {NOTIFICATION_META[n.type]?.label}
            </span>
          </span>
          <span className="mt-0.5 block text-sm text-foreground/70">{n.message}</span>
          <span className="mt-1 block text-[11px] text-foreground/40">{relativeTimeAr(n.createdAt)}</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            await fetch(`/api/notifications/${n.id}`, { method: "DELETE" });
            setItems((prev) => prev.filter((it) => it.id !== n.id));
          }}
          className="mt-0.5 shrink-0 text-foreground/30 hover:text-red-500"
          aria-label="حذف"
          title="حذف"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">الإشعارات</h1>
          <p className="text-sm text-foreground/60">{total} إشعار</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={markAllRead} className="rounded-lg border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy/5">
            تحديد الكل كمقروء
          </button>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            حذف المختار ({selected.size})
          </button>
          <button onClick={deleteOld} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-black/5">
            حذف المقروء القديم (+30 يوم)
          </button>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-white p-3 shadow-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none">
          <option value="all">كل الحالات</option>
          <option value="unread">غير مقروء</option>
          <option value="read">مقروء</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none">
          <option value="">كل الأنواع</option>
          {(Object.keys(typesByCategory) as (keyof typeof typesByCategory)[]).map((cat) => (
            <optgroup key={cat} label={NOTIFICATION_CATEGORY_LABELS_AR[cat]}>
              {typesByCategory[cat].map((t) => (
                <option key={t} value={t}>
                  {NOTIFICATION_META[t].label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none">
          <option value="">كل الأولويات</option>
          {(["urgent", "high", "normal", "low"] as NotificationPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none">
          <option value="">كل الفترات</option>
          <option value="1">آخر يوم</option>
          <option value="7">آخر أسبوع</option>
          <option value="30">آخر 30 يومًا</option>
        </select>
        <label className="ms-auto flex items-center gap-1.5 text-sm text-foreground/70">
          <input type="checkbox" checked={groupByDay} onChange={(e) => setGroupByDay(e.target.checked)} />
          تجميع حسب اليوم
        </label>
      </div>

      {/* القائمة */}
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-12 text-center text-sm text-foreground/50">جارٍ التحميل...</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-foreground/50">لا توجد إشعارات مطابقة</p>
        ) : grouped ? (
          Object.entries(grouped).map(([day, list]) => (
            <div key={day}>
              <div className="bg-navy/5 px-4 py-2 text-xs font-medium text-foreground/60">{relativeTimeAr(list[0].createdAt)}</div>
              <div className="divide-y divide-black/5">{list.map(renderRow)}</div>
            </div>
          ))
        ) : (
          <div className="divide-y divide-black/5">{items.map(renderRow)}</div>
        )}
      </div>

      {/* الترقيم */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-sm text-foreground/60">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
