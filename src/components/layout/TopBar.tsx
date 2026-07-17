"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { NotificationBell } from "./NotificationBell";

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

export function TopBar({ fullName }: { fullName: string }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white/80 px-6 py-4 backdrop-blur">
      <h1 className="font-amiri text-lg font-bold text-navy">{title}</h1>

      <div className="flex items-center gap-4">
        <NotificationBell />

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
