import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCase } from "@/lib/rbac";
import { notifyBulk } from "@/lib/notifications/send";
import { attendingLawyerIds } from "@/lib/sessionMemo";

type Params = { params: Promise<{ id: string }> };

/**
 * تسجيل/تحديث محضر الجلسة (SessionMinutes) — محضر واحد لكل جلسة.
 * حفظ المحضر يسجّل الجلسة كـ«انعقدت». ربط مذكرة اختياري — إن لم تُربط يُرسَل تذكير غير حاجب فقط.
 */
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

  // ربط مذكرة إن مُرّرت (memoId) — يجب أن تكون من نفس القضية.
  let effectiveMemoId = existing.memoId;
  if (typeof body.memoId === "string" && body.memoId) {
    const memo = await prisma.legalMemo.findUnique({ where: { id: body.memoId }, select: { caseId: true } });
    if (!memo || memo.caseId !== existing.caseId) {
      return NextResponse.json({ error: "المذكرة غير موجودة أو ليست من هذه القضية" }, { status: 400 });
    }
    effectiveMemoId = body.memoId;
  }

  // ربط المذكرة اختياري: يُسمح بحفظ المحضر (وتسجيل الجلسة «منعقدة») دون مذكرة.
  // إن لم تُربط مذكرة، نرسل تذكيرًا غير حاجب للمحامين الحاضرين (لا يمنع الحفظ).
  if (!effectiveMemoId) {
    const recipients = attendingLawyerIds(existing.case).filter((uid) => uid !== session.user.id);
    await notifyBulk(recipients, {
      type: "session_memo_required",
      priority: "normal",
      title: "تذكير: مذكرة الجلسة",
      message: `الجلسة المنعقدة بلا مذكرة مرتبطة — يُستحسن ربط مذكرة (اختياري).`,
      actionUrl: `/cases/${existing.caseId}`,
      resourceType: "session",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  const minutes = await prisma.sessionMinutes.upsert({
    where: { sessionId: id },
    update: { content, recordedById: session.user.id },
    create: { sessionId: id, content, recordedById: session.user.id },
  });

  // تسجيل الجلسة كمنعقدة + تثبيت المذكرة المرتبطة.
  await prisma.session.update({ where: { id }, data: { status: "held", memoId: effectiveMemoId } });

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
