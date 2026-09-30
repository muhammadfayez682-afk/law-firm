import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canEditPrecedent,
  isCaseType,
  isPrecedentSource,
  isVerdictDegreeValue,
  isVerdictResultValue,
} from "@/lib/precedents";
import { deleteFromR2 } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const precedent = await prisma.judgmentPrecedent.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!precedent) return NextResponse.json({ error: "السابقة غير موجودة" }, { status: 404 });
  if (!canEditPrecedent(session.user, precedent)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه السابقة" }, { status: 403 });
  }

  const body = await request.json();
  const data: Prisma.JudgmentPrecedentUpdateInput = {};

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.principle === "string" && body.principle.trim()) data.principle = body.principle.trim();
  if (body.fullText !== undefined) data.fullText = typeof body.fullText === "string" ? body.fullText.trim() || null : null;
  if (body.court !== undefined) data.court = typeof body.court === "string" ? body.court.trim() || null : null;
  if (isCaseType(body.caseType)) data.caseType = body.caseType;
  if (body.degree !== undefined) data.degree = isVerdictDegreeValue(body.degree) ? body.degree : null;
  if (body.result !== undefined) data.result = isVerdictResultValue(body.result) ? body.result : null;
  if (body.judgmentNumber !== undefined) data.judgmentNumber = typeof body.judgmentNumber === "string" ? body.judgmentNumber.trim() || null : null;
  if (body.judgmentDate !== undefined) {
    const d = body.judgmentDate ? new Date(body.judgmentDate) : null;
    data.judgmentDate = d && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (Array.isArray(body.keywords)) {
    const kw = (body.keywords as unknown[])
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim());
    data.keywords = [...new Set<string>(kw)].slice(0, 30);
  }
  if (isPrecedentSource(body.source)) data.source = body.source;
  if (body.sourceCaseId !== undefined) data.sourceCaseId = typeof body.sourceCaseId === "string" ? body.sourceCaseId.trim() || null : null;
  if (body.sourceVerdictId !== undefined) data.sourceVerdictId = typeof body.sourceVerdictId === "string" ? body.sourceVerdictId.trim() || null : null;

  const updated = await prisma.judgmentPrecedent.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "JudgmentPrecedent", resourceId: id },
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const precedent = await prisma.judgmentPrecedent.findUnique({ where: { id }, select: { id: true, createdById: true, attachmentKey: true } });
  if (!precedent) return NextResponse.json({ error: "السابقة غير موجودة" }, { status: 404 });
  if (!canEditPrecedent(session.user, precedent)) {
    return NextResponse.json({ error: "لا تملك صلاحية حذف هذه السابقة" }, { status: 403 });
  }

  // حذف مرفق R2 أولًا (لا نُفشل الحذف إن تعذّر حذف المرفق).
  if (precedent.attachmentKey) {
    try {
      await deleteFromR2(precedent.attachmentKey);
    } catch {
      /* تجاهل — قد يكون المرفق محذوفًا مسبقًا */
    }
  }

  await prisma.judgmentPrecedent.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "delete", resourceType: "JudgmentPrecedent", resourceId: id },
  });

  return NextResponse.json({ ok: true });
}
