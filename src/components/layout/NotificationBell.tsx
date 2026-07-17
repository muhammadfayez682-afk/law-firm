"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import type { NotificationPriority, NotificationType } from "@prisma/client";
import { NOTIFICATION_META } from "@/lib/notifications/meta";
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

const POLL_MS = 30_000;

const PRIORITY_BG: Record<NotificationPriority, string> = {
  urgent: "bg-red-50",
  high: "bg-orange-50",
  normal: "bg-white",
  low: "bg-white",
};

const PRIORITY_TOAST_BG: Record<string, string> = {
  urgent: "#FEE2E2",
  high: "#FFEDD5",
};

function typeIcon(type: NotificationType): string {
  return NOTIFICATION_META[type]?.icon ?? "🔔";
}

export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const lastPollRef = useRef<number>(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.count ?? 0);

      // Toast للإشعارات العاجلة/المهمّة الجديدة منذ آخر استطلاع.
      if ((data.count ?? 0) > 0) {
        const listRes = await fetch("/api/notifications?status=unread&page=1", { cache: "no-store" });
        if (listRes.ok) {
          const listData = await listRes.json();
          const fresh: NotificationItem[] = (listData.notifications ?? []).filter(
            (n: NotificationItem) =>
              new Date(n.createdAt).getTime() > lastPollRef.current &&
              (n.priority === "urgent" || n.priority === "high")
          );
          for (const n of fresh) {
            toast(n.title, {
              icon: "🔔",
              duration: 5000,
              style: { background: PRIORITY_TOAST_BG[n.priority] ?? "#fff", direction: "rtl" },
            });
          }
        }
      }
      lastPollRef.current = Date.now();
    } catch {
      // تجاهل أخطاء الشبكة العابرة في الاستطلاع.
    }
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  // إغلاق القائمة عند النقر خارجها.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function openDropdown() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const res = await fetch("/api/notifications?status=all&page=1", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setItems((data.notifications ?? []).slice(0, 10));
        }
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleClick(n: NotificationItem) {
    if (!n.isRead) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      setCount((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, isRead: true } : it)));
    }
    setOpen(false);
    if (n.actionUrl) router.push(n.actionUrl);
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setCount(0);
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={openDropdown}
        className="relative rounded-full border border-black/10 p-2 text-navy/70 transition-colors hover:bg-navy/5"
        aria-label="الإشعارات"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[360px] max-w-[92vw] overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <h3 className="font-semibold text-navy">الإشعارات</h3>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-taradhi hover:underline"
            >
              تحديد الكل كمقروء
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-foreground/50">جارٍ التحميل...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-foreground/50">لا توجد إشعارات</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-3 border-b border-black/5 px-4 py-3 text-right transition-colors hover:bg-navy/5 ${PRIORITY_BG[n.priority]}`}
                >
                  <span className="mt-0.5 text-lg leading-none">{typeIcon(n.type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {!n.isRead && <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                      <span className="truncate font-semibold text-navy">{n.title}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-foreground/70">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-foreground/40">{relativeTimeAr(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-black/5 px-4 py-3 text-center text-sm font-medium text-taradhi hover:bg-navy/5"
          >
            عرض الكل
          </Link>
        </div>
      )}
    </div>
  );
}
