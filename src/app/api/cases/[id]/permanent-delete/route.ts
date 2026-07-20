import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/rbac";
import { checkDeleteEligibility } from "@/lib/caseArchive";
import { notifyBulk } from "@/lib/notifications/send";
import { getUserIdsByRoles } from "@/lib/notifications/recipients";

type Params = { params: Promise<{ id: string }> };

const CONFIRM_TEXT = "حذف نهائي";
const MIN_REASON = 50;

/**
 * حذف نهائي (ناعم أولًا) — مسؤول النظام فقط، بضوابط صارمة.
 * يُضبط deletedAt؛ ثم يحذفه الكرون فعليًا بعد 30 يومًا (شبكة أمان).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "الحذف النهائي متاح لمسؤول النظام فقط" }, { status: 403 });
  }

  const { id } = await params;
  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      _count: { select: { sessions: { where: { status: "held" } }, invoices: { where: { status: "paid" } } } },
    },
  });
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (caseData.deletedAt) return NextResponse.json({ error: "القضية محذوفة بالفعل" }, { status: 400 });

  const eligibility = checkDeleteEligibility(session.user, {
    status: caseData.status,
    archivedAt: caseData.archivedAt,
    heldSessionsCount: caseData._count.sessions,
    paidInvoicesCount: caseData._count.invoices,
  });
  if (!eligibility.allowed) {
    return NextResponse.json({ error: "delete_not_allowed", message: eligibility.reason }, { status: 400 });
  }

  const body = await request.json();
  if (body.confirmation !== CONFIRM_TEXT) {
    return NextResponse.json({ error: `يجب كتابة «${CONFIRM_TEXT}» للتأكيد` }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < MIN_REASON) {
    return NextResponse.json({ error: `سبب الحذف يجب ألا يقل عن ${MIN_REASON} حرفًا` }, { status: 400 });
  }

  const updated = await prisma.case.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: session.user.id, deleteReason: reason },
  });

  // تسجيل مفصّل في سجل التدقيق (يُحفظ حتى بعد الحذف الفعلي).
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "delete", resourceType: "case_deleted", resourceId: id },
  });

  // إشعار عاجل لكل مسؤولي النظام.
  const adminIds = (await getUserIdsByRoles(["system_admin"])).filter((uid) => uid !== session.user.id);
  await notifyBulk(adminIds, {
    type: "case_deleted",
    priority: "urgent",
    title: "⚠️ حذف نهائي لقضية",
    message: `حُذفت نهائيًا القضية «${caseData.title}» (${caseData.internalNumber}) بواسطة ${session.user.name ?? "مسؤول"}: ${reason}`,
    resourceType: "Case",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json({ ok: true, softDeleted: true, id: updated.id });
}
