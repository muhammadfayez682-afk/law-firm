import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, resolveCasePermission } from "@/lib/rbac";
import { memoVisibilityWhere } from "@/lib/memos";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("caseId");

  const memos = await prisma.legalMemo.findMany({
    where: {
      ...memoVisibilityWhere(session.user),
      ...(caseId ? { caseId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      case: { select: { id: true, title: true, internalNumber: true } },
      authoredBy: { select: { fullName: true } },
    },
  });

  return NextResponse.json(memos);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const memoType = typeof body.memoType === "string" ? body.memoType.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!body.caseId) return NextResponse.json({ error: "القضية مطلوبة" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "عنوان المذكرة مطلوب" }, { status: 400 });
  if (!memoType) return NextResponse.json({ error: "نوع المذكرة مطلوب" }, { status: 400 });

  // كتابة المذكرة تتطلب صلاحية write_memo (أساسية: باحث/مسؤول بوصول، أو تفويض فعّال).
  const caseData = await prisma.case.findUnique({
    where: { id: body.caseId },
    include: {
      team: true,
      accessOverrides: true,
      delegations: {
        select: {
          grantedToId: true,
          grantedById: true,
          permission: true,
          revokedAt: true,
          expiresAt: true,
          grantedBy: { select: { role: true } },
        },
      },
    },
  });
  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }
  const memoPerm = resolveCasePermission(session.user, caseData, "write_memo");
  if (!memoPerm.allowed) {
    return NextResponse.json({ error: "لا تملك صلاحية كتابة مذكرة لهذه القضية" }, { status: 403 });
  }

  const created = await prisma.legalMemo.create({
    data: {
      caseId: body.caseId,
      title,
      memoType,
      content,
      legalBasis: body.legalBasis?.trim() || null,
      precedents: body.precedents?.trim() || null,
      circulars: body.circulars?.trim() || null,
      authoredById: session.user.id,
      status: "draft",
    },
  });

  // ربط تلقائي بجلسة عند تمرير sessionId (مذكرة الجلسة) — للجلسة من نفس القضية إن لم تكن مرتبطة.
  if (typeof body.sessionId === "string" && body.sessionId) {
    const targetSession = await prisma.session.findUnique({
      where: { id: body.sessionId },
      select: { id: true, caseId: true, memoId: true },
    });
    if (targetSession && targetSession.caseId === body.caseId && !targetSession.memoId) {
      await prisma.session.update({ where: { id: targetSession.id }, data: { memoId: created.id } });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "LegalMemo",
      resourceId: created.id,
      viaDelegation: memoPerm.viaDelegation,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
