import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { canReviewMemo } from "@/lib/memos";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** مراجعة المذكرة (اعتماد / طلب تعديلات) — للمحامي فقط، والمذكرة يجب أن تكون مُرسلة. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canReviewMemo(session.user.role)) {
    return NextResponse.json({ error: "مراجعة المذكرات متاحة للمحامي فقط" }, { status: 403 });
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
    return NextResponse.json({ error: "لا تملك صلاحية مراجعة هذه المذكرة" }, { status: 403 });
  }

  if (memo.status !== "submitted") {
    return NextResponse.json(
      { error: "لا يمكن مراجعة المذكرة إلا وهي مُرسلة للمراجعة." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const action = body.action;
  const comments = typeof body.comments === "string" ? body.comments.trim() : "";

  if (action !== "approve" && action !== "request_changes") {
    return NextResponse.json({ error: "إجراء المراجعة غير صالح" }, { status: 400 });
  }
  if (action === "request_changes" && !comments) {
    return NextResponse.json({ error: "ملاحظات التعديل إلزامية عند طلب تعديلات" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "changes_requested";

  const [updated] = await prisma.$transaction([
    prisma.legalMemo.update({
      where: { id },
      data: {
        status: newStatus,
        ...(action === "approve"
          ? { approvedById: session.user.id, approvedAt: new Date() }
          : {}),
      },
    }),
    prisma.memoReview.create({
      data: {
        memoId: id,
        reviewedById: session.user.id,
        action: action === "approve" ? "approved" : "changes_requested",
        comments: comments || (action === "approve" ? "اعتُمدت المذكرة." : ""),
      },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "LegalMemo",
      resourceId: id,
    },
  });

  // إشعار كاتب المذكرة (الباحث) بنتيجة المراجعة.
  if (memo.authoredById !== session.user.id) {
    await notify({
      recipientId: memo.authoredById,
      type: action === "approve" ? "memo_approved" : "memo_changes_requested",
      priority: action === "approve" ? "normal" : "high",
      title: action === "approve" ? "اعتُمدت مذكرتك" : "طُلبت تعديلات على مذكرتك",
      message:
        action === "approve"
          ? `اعتُمدت المذكرة «${memo.title}».`
          : `طُلبت تعديلات على المذكرة «${memo.title}»: ${comments}`,
      actionUrl: `/memos/${id}`,
      resourceType: "LegalMemo",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json(updated);
}
