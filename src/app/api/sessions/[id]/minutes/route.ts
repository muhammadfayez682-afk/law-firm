import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCase } from "@/lib/rbac";
import { notifyBulk } from "@/lib/notifications/send";
import { attendingLawyerIds, SESSION_MEMO_REQUIRED_MESSAGE } from "@/lib/sessionMemo";

type Params = { params: Promise<{ id: string }> };

/**
 * تسجيل/تحديث محضر الجلسة (SessionMinutes) — محضر واحد لكل جلسة.
 * ⚠️ حفظ المحضر يسجّل الجلسة كـ«انعقدت»، ولا يُقبل دون ربط مذكرة (ولو مسودّة).
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

  // ⚠️ الإلزام: حفظ المحضر يجعل الجلسة «منعقدة» — لا يُقبل دون مذكرة مرتبطة.
  if (!effectiveMemoId) {
    // تذكير المحامين الحاضرين بكتابة المذكرة.
    const recipients = attendingLawyerIds(existing.case).filter((uid) => uid !== session.user.id);
    await notifyBulk(recipients, {
      type: "session_memo_required",
      priority: "high",
      title: "مطلوب كتابة مذكرة الجلسة",
      message: `الجلسة المنعقدة تحتاج ربط مذكرة قبل إغلاق محضرها.`,
      actionUrl: `/cases/${existing.caseId}`,
      resourceType: "session",
      resourceId: id,
      triggeredById: session.user.id,
    });
    return NextResponse.json({ error: SESSION_MEMO_REQUIRED_MESSAGE }, { status: 400 });
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
