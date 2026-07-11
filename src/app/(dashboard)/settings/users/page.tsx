import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";
import { UsersManager } from "./UsersManager";

const ACTIVE_CASE_STATUSES_EXCLUDED = ["closed", "archived"] as const;

export default async function UsersSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (!canManageUsers(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        إدارة المستخدمين متاحة للشركاء فقط.
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          responsibleCases: {
            where: { status: { notIn: [...ACTIVE_CASE_STATUSES_EXCLUDED] } },
          },
        },
      },
    },
  });

  const initialUsers = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    activeCases: u._count.responsibleCases,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">إدارة المستخدمين</h1>
        <p className="text-sm text-foreground/60">
          إضافة وتعديل المستخدمين وتعطيل الحسابات. الحساب المعطّل لا يُحذف — يُحفظ سجله وقضاياه.
        </p>
      </div>

      <UsersManager initialUsers={initialUsers} currentUserId={session.user.id} />
    </div>
  );
}
