import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordStrengthError } from "@/lib/validators";

/** تغيير المستخدم لكلمة مروره: تحقق من الحالية + قوة الجديدة + حفظ + تدقيق. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "كلمة المرور الحالية والجديدة مطلوبتان" },
      { status: 400 }
    );
  }

  const strengthError = passwordStrengthError(newPassword);
  if (strengthError) {
    return NextResponse.json({ error: strengthError }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }

  const currentValid = await bcrypt.compare(currentPassword, user.password);
  if (!currentValid) {
    return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
  }

  if (await bcrypt.compare(newPassword, user.password)) {
    return NextResponse.json(
      { error: "كلمة المرور الجديدة يجب أن تختلف عن الحالية" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "update",
      resourceType: "UserPassword",
      resourceId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
