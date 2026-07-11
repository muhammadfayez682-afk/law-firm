import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCase } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

/** تسجيل/تحديث محضر الجلسة (SessionMinutes) — محضر واحد لكل جلسة. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.session.findUnique({
    where: { id },
    include: { case: { include: { team: true, accessOverrides: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 });
  }

  if (!canEditCase(session.user, existing.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية تسجيل محضر لهذه الجلسة" }, { status: 403 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "نص المحضر مطلوب" }, { status: 400 });
  }

  const minutes = await prisma.sessionMinutes.upsert({
    where: { sessionId: id },
    update: { content, recordedById: session.user.id },
    create: { sessionId: id, content, recordedById: session.user.id },
  });

  // تسجيل الجلسة كمنعقدة تلقائيًا عند إدخال محضرها.
  await prisma.session.update({ where: { id }, data: { status: "held" } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "SessionMinutes",
      resourceId: minutes.id,
    },
  });

  return NextResponse.json(minutes, { status: 201 });
}
