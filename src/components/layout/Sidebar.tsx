"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { canManageInvoices, canManageUsers, canViewAuditLog, isManagement } from "@/lib/rbac";
import type { NavItem } from "@/types";

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildNavGroups(role: UserRole): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "الرئيسية",
      items: [{ href: "/dashboard", label: "لوحة التحكم", icon: "dashboard" }],
    },
    {
      label: "إدارة القضايا",
      items: [
        { href: "/cases", label: "القضايا", icon: "cases" },
        { href: "/clients", label: "العملاء", icon: "clients" },
        { href: "/sessions", label: "الجلسات", icon: "sessions" },
        // المذكرات تظهر لمن يشارك في العمل القضائي (لا السكرتارية ولا المحاسب).
        ...(role !== "secretary" && role !== "accountant"
          ? [{ href: "/memos", label: "المذكرات", icon: "memos" as const }]
          : []),
        { href: "/calendar", label: "التقويم", icon: "calendar" },
      ],
    },
    {
      label: "الأدوات",
      items: [
        { href: "/templates", label: "النماذج", icon: "templates" },
        { href: "/reports", label: "التقارير والأداء", icon: "reports" },
      ],
    },
  ];

  if (canManageInvoices(role)) {
    groups.push({
      label: "المالية",
      items: [{ href: "/invoices", label: "الفواتير والمصاريف", icon: "invoices" }],
    });
  }

  const adminItems: NavItem[] = [];
  if (canManageUsers(role)) {
    adminItems.push({ href: "/settings/users", label: "المستخدمون", icon: "users" });
  }
  if (canViewAuditLog(role)) {
    adminItems.push({ href: "/audit", label: "سجل التدقيق", icon: "audit" });
  }
  if (isManagement(role)) {
    adminItems.push({ href: "/settings/case-flows", label: "مسارات القضايا", icon: "settings" });
  }
  if (adminItems.length > 0) {
    groups.push({ label: "الإدارة", items: adminItems });
  }

  return groups;
}

const ICONS: Record<NavItem["icon"], React.ReactNode> = {
  dashboard: (
    <path d="M3 12l9-9 9 9M5 10v10h14V10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  cases: (
    <path
      d="M3 7h18M3 7l1.5 12a1 1 0 001 1h13a1 1 0 001-1L21 7M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  clients: (
    <path
      d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  calendar: (
    <path
      d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  sessions: (
    <path
      d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  invoices: (
    <path
      d="M6 2h9l3 3v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 22V2zM9 8h6M9 12h6M9 16h4"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  users: (
    <path
      d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM17 11l2 2 4-4"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  audit: (
    <path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  templates: (
    <path
      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  memos: (
    <path
      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 15l2 2 4-4"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  reports: (
    <path
      d="M3 3v18h18M8 17V10M13 17V6M18 17v-4"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  settings: (
    <path
      d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export function Sidebar({
  fullName,
  roleLabel,
  role,
}: {
  fullName: string;
  roleLabel: string;
  role: UserRole;
}) {
  const pathname = usePathname();

  const navGroups = buildNavGroups(role);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-navy text-white h-screen sticky top-0">
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold font-amiri text-lg font-bold text-navy">
            م
          </div>
          <div>
            <p className="font-amiri text-xl font-bold text-gold-light">ميزان</p>
            <p className="text-[11px] text-white/50">قدوم الحقائق للمحاماة</p>
          </div>
        </div>
        <div className="mt-5 h-px w-full bg-gradient-to-l from-gold via-gold/40 to-transparent" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-gold/15 text-gold-light font-semibold border-r-2 border-gold"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-5 w-5 shrink-0"
                      >
                        {ICONS[item.icon]}
                      </svg>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-medium text-white">{fullName}</p>
        <p className="text-xs text-gold-light">{roleLabel}</p>
      </div>
    </aside>
  );
}
