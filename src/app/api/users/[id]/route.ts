import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import type { Prisma, UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";
import { isValidSaudiPhone, passwordStrengthError } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

const VALID_ROLES: UserRole[] = [
  "system_admin",
  "supervisor",
  "lawyer",
  "researcher",
  "secretary",
  "accountant",
];
const ACTIVE_CASE_STATUSES_EXCLUDED = ["closed", "archived"] as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "تعديل المستخدمين متاح للشركاء فقط" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }

  const body = await request.json();
  const data: Prisma.UserUpdateInput = {};

  if (typeof body.fullName === "string" && body.fullName.trim()) {
    data.fullName = body.fullName.trim();
  }
  if (body.phone !== undefined) {
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (phone && !isValidSaudiPhone(phone)) {
      return NextResponse.json({ error: "رقم الجوال غير صحيح (مثال: 05XXXXXXXX)" }, { status: 400 });
    }
    data.phone = phone || null;
  }
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "الدور غير صالح" }, { status: 400 });
    }
    // منع تنزيل آخر مسؤول نظام نشط عن دوره.
    if (target.role === "system_admin" && body.role !== "system_admin") {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: "system_admin", isActive: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: "يجب بقاء مسؤول نظام واحد نشط على الأقل — لا يمكن تغيير دور آخر مسؤول." },
          { status: 400 }
        );
      }
    }
    data.role = body.role;
  }
  // إعادة تعيين كلمة المرور: نرفض الكلمات الضعيفة بدل تجاهلها بصمت (كان يُظهر "تم" دون تغيير).
  if (typeof body.password === "string" && body.password.trim()) {
    const strengthError = passwordStrengthError(body.password.trim());
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }
    data.password = await bcrypt.hash(body.password.trim(), 10);
  }

  // تعطيل/تفعيل الحساب مع قواعد الحماية.
  if (body.isActive === false && target.isActive) {
    if (target.id === session.user.id) {
      return NextResponse.json({ error: "لا يمكنك تعطيل حسابك الخاص." }, { status: 400 });
    }
    if (target.role === "system_admin") {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: "system_admin", isActive: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: "يجب بقاء مسؤول نظام واحد نشط على الأقل." },
          { status: 400 }
        );
      }
    }

    const activeCases = await prisma.case.count({
      where: { responsibleLawyerId: id, status: { notIn: [...ACTIVE_CASE_STATUSES_EXCLUDED] } },
    });

    if (activeCases > 0) {
      const reassignToId = typeof body.reassignToId === "string" ? body.reassignToId : null;
      if (!reassignToId && body.force !== true) {
        // إشارة للواجهة بأن هناك قضايا نشطة تحتاج قرارًا (نقل أو تجاهل).
        return NextResponse.json(
          {
            error: "لدى هذا المستخدم قضايا نشطة",
            requiresReassignment: true,
            activeCases,
          },
          { status: 409 }
        );
      }
      if (reassignToId) {
        const newOwner = await prisma.user.findUnique({ where: { id: reassignToId } });
        if (!newOwner || !newOwner.isActive) {
          return NextResponse.json(
            { error: "المحامي المُختار لنقل القضايا غير صالح أو معطّل." },
            { status: 400 }
          );
        }
        await prisma.case.updateMany({
          where: { responsibleLawyerId: id, status: { notIn: [...ACTIVE_CASE_STATUSES_EXCLUDED] } },
          data: { responsibleLawyerId: reassignToId },
        });
      }
    }

    data.isActive = false;
  } else if (body.isActive === true && !target.isActive) {
    data.isActive = true;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "User",
      resourceId: id,
    },
  });

  return NextResponse.json(updated);
}
