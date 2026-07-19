import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

/**
 * إصدار «نسخة معدّلة (مذكرة تكميلية)» من مذكرة معتمدة/مُقدَّمة للمحكمة.
 * المذكرات المعتمدة لا تُعدَّل؛ بدلًا منها تُنشأ مذكرة جديدة تعود لدورة الاعتماد
 * وتُربط بالأصل عبر parentMemoId.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  if (session.user.role === "accountant" || session.user.role === "secretary") {
    return NextResponse.json({ error: "لا تملك صلاحية إنشاء مذكرة تكميلية" }, { status: 403 });
  }

  const { id } = await params;
  const original = await prisma.legalMemo.findUnique({
    where: { id },
    include: { case: { include: { team: true, accessOverrides: true } } },
  });
  if (!original) {
    return NextResponse.json({ error: "المذكرة غير موجودة" }, { status: 404 });
  }
  if (!canAccessCase(session.user, original.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية على هذه القضية" }, { status: 403 });
  }
  if (original.status !== "approved" && original.status !== "submitted_to_court") {
    return NextResponse.json(
      { error: "النسخة المعدّلة تُصدَر فقط من مذكرة معتمدة أو مُقدَّمة للمحكمة" },
      { status: 400 }
    );
  }

  const supplement = await prisma.legalMemo.create({
    data: {
      caseId: original.caseId,
      title: `[تكميلية] ${original.title}`,
      memoType: original.memoType,
      content: original.content,
      legalBasis: original.legalBasis,
      precedents: original.precedents,
      circulars: original.circulars,
      status: "draft",
      version: original.version + 1,
      parentMemoId: original.id,
      authoredById: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "LegalMemo", resourceId: supplement.id },
  });

  return NextResponse.json({ id: supplement.id }, { status: 201 });
}
