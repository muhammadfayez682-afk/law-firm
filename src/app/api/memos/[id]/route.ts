import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { canEditMemo } from "@/lib/memos";

type Params = { params: Promise<{ id: string }> };

async function loadMemo(id: string) {
  return prisma.legalMemo.findUnique({
    where: { id },
    include: { case: { include: { team: true, accessOverrides: true } } },
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const memo = await loadMemo(id);
  if (!memo) {
    return NextResponse.json({ error: "المذكرة غير موجودة" }, { status: 404 });
  }
  if (!canAccessCase(session.user, memo.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذه المذكرة" }, { status: 403 });
  }

  return NextResponse.json(memo);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const memo = await loadMemo(id);
  if (!memo) {
    return NextResponse.json({ error: "المذكرة غير موجودة" }, { status: 404 });
  }

  if (!canEditMemo(session.user, memo)) {
    return NextResponse.json(
      { error: "لا يمكن تعديل المذكرة بعد إرسالها إلا إذا طلب المحامي تعديلات." },
      { status: 403 }
    );
  }

  const body = await request.json();

  const updated = await prisma.legalMemo.update({
    where: { id },
    data: {
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined,
      memoType:
        typeof body.memoType === "string" && body.memoType.trim() ? body.memoType.trim() : undefined,
      content: body.content !== undefined ? String(body.content) : undefined,
      legalBasis: body.legalBasis !== undefined ? body.legalBasis?.trim() || null : undefined,
      precedents: body.precedents !== undefined ? body.precedents?.trim() || null : undefined,
      circulars: body.circulars !== undefined ? body.circulars?.trim() || null : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "LegalMemo",
      resourceId: id,
    },
  });

  return NextResponse.json(updated);
}
