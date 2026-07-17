import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** إرسال المذكرة للمحامي للمراجعة — للباحث كاتب المذكرة، فقط من مسودة أو تعديلات مطلوبة. */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const memo = await prisma.legalMemo.findUnique({
    where: { id },
    include: { case: { include: { team: true } } },
  });
  if (!memo) {
    return NextResponse.json({ error: "المذكرة غير موجودة" }, { status: 404 });
  }

  const isAuthorOrAdmin =
    memo.authoredById === session.user.id || session.user.role === "system_admin";
  if (!isAuthorOrAdmin) {
    return NextResponse.json({ error: "إرسال المذكرة متاح لكاتبها فقط" }, { status: 403 });
  }

  if (memo.status !== "draft" && memo.status !== "changes_requested") {
    return NextResponse.json(
      { error: "لا يمكن إرسال المذكرة إلا وهي مسودة أو بعد طلب تعديلات." },
      { status: 400 }
    );
  }

  const updated = await prisma.legalMemo.update({
    where: { id },
    data: { status: "submitted" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "LegalMemo",
      resourceId: id,
    },
  });

  // إشعار مراجعي القضية (المحامي المسؤول + مشرفو/محامو الفريق) بمذكرة بانتظار المراجعة.
  const reviewerIds = [
    memo.case.responsibleLawyerId,
    ...memo.case.team.filter((m) => m.roleInCase === "lawyer" || m.roleInCase === "supervisor").map((m) => m.userId),
  ].filter((uid) => uid !== session.user.id);
  await notifyBulk(reviewerIds, {
    type: "memo_pending_review",
    priority: "high",
    title: "مذكرة بانتظار مراجعتك",
    message: `المذكرة «${memo.title}» أُرسلت لمراجعتك.`,
    actionUrl: `/memos/${id}`,
    resourceType: "LegalMemo",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(updated);
}
