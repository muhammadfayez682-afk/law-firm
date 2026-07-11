import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

export type KpiCard = {
  label: string;
  value: string | number;
  hint?: string;
};

export type NavItem = {
  href: string;
  label: string;
  icon:
    | "dashboard"
    | "cases"
    | "clients"
    | "calendar"
    | "sessions"
    | "memos"
    | "templates"
    | "reports"
    | "invoices"
    | "users"
    | "audit"
    | "settings";
};
