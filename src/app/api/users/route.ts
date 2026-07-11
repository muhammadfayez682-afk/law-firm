import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";

const VALID_ROLES: UserRole[] = ["partner", "senior_lawyer", "lawyer", "secretary", "accountant"];
const ACTIVE_CASE_STATUSES_EXCLUDED = ["closed", "archived"] as const;

/** توليد كلمة مرور مؤقتة عند عدم إدخال واحدة. */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "إدارة المستخدمين متاحة للشركاء فقط" }, { status: 403 });
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

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "إضافة المستخدمين متاحة للشركاء فقط" }, { status: 403 });
  }

  const body = await request.json();
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role as UserRole;

  if (!fullName) return NextResponse.json({ error: "الاسم الكامل مطلوب" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "البريد الإلكتروني مطلوب" }, { status: 400 });
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "الدور مطلوب" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "البريد الإلكتروني مستخدم مسبقًا" }, { status: 409 });
  }

  const tempPassword =
    typeof body.password === "string" && body.password.trim().length >= 6
      ? body.password.trim()
      : generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const created = await prisma.user.create({
    data: {
      fullName,
      email,
      phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
      role,
      password: passwordHash,
    },
    select: { id: true, fullName: true, email: true, role: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "User",
      resourceId: created.id,
    },
  });

  // كلمة المرور المؤقتة تُعاد مرة واحدة فقط ليشاركها الشريك مع المستخدم.
  return NextResponse.json({ ...created, tempPassword }, { status: 201 });
}
