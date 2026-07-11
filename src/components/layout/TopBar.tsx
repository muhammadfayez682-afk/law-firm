"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const PAGE_TITLES: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "لوحة التحكم" },
  { prefix: "/cases", label: "القضايا" },
  { prefix: "/clients", label: "العملاء" },
  { prefix: "/calendar", label: "التقويم والجلسات" },
  { prefix: "/templates", label: "النماذج" },
  { prefix: "/reports", label: "التقارير والأداء" },
];

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "ميزان";
  const match = PAGE_TITLES.find((p) => pathname.startsWith(p.prefix));
  return match?.label ?? "ميزان";
}

export function TopBar({
  fullName,
  alertsCount = 0,
}: {
  fullName: string;
  alertsCount?: number;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white/80 px-6 py-4 backdrop-blur">
      <h1 className="font-amiri text-lg font-bold text-navy">{title}</h1>

      <div className="flex items-center gap-4">
        <button
          type="button"
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
          {alertsCount > 0 && (
            <span className="absolute -top-1 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {alertsCount > 9 ? "9+" : alertsCount}
            </span>
          )}
        </button>

        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium text-navy">{fullName}</p>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-light"
        >
          تسجيل الخروج
        </button>
      </div>
    </header>
  );
}
