import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { canReviewMemo } from "@/lib/memos";

type Params = { params: Promise<{ id: string }> };

/** تحديد المذكرة كمُقدَّمة للمحكمة — للمحامي، فقط بعد اعتمادها. */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canReviewMemo(session.user.role)) {
    return NextResponse.json({ error: "هذا الإجراء متاح للمحامي فقط" }, { status: 403 });
  }

  const { id } = await params;
  const memo = await prisma.legalMemo.findUnique({
    where: { id },
    include: { case: { include: { team: true, accessOverrides: true } } },
  });
  if (!memo) {
    return NextResponse.json({ error: "المذكرة غير موجودة" }, { status: 404 });
  }
  if (!canAccessCase(session.user, memo.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية على هذه المذكرة" }, { status: 403 });
  }

  if (memo.status !== "approved") {
    return NextResponse.json(
      { error: "لا يمكن تحديد المذكرة كمُقدَّمة إلا بعد اعتمادها." },
      { status: 400 }
    );
  }

  const updated = await prisma.legalMemo.update({
    where: { id },
    data: { status: "submitted_to_court" },
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
