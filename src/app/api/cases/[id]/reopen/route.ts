import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/rbac";
import { CASE_STATUS_AFTER_REOPEN } from "@/lib/caseClosure";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "إعادة فتح القضية صلاحية حصرية لمسؤول النظام" }, { status: 403 });
  }

  const { id } = await params;

  const caseData = await prisma.case.findUnique({ where: { id } });
  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (caseData.status !== "closed") {
    return NextResponse.json({ error: "لا يمكن إعادة فتح إلا قضية مغلقة" }, { status: 400 });
  }

  const body = await request.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "سبب إعادة الفتح مطلوب" }, { status: 400 });
  }

  const [reopenLog, updatedCase] = await prisma.$transaction([
    prisma.caseReopenLog.create({
      data: { caseId: id, reopenedById: session.user.id, reason },
    }),
    prisma.case.update({
      where: { id },
      data: { status: CASE_STATUS_AFTER_REOPEN, closedDate: null },
    }),
    prisma.caseClosureRequest.deleteMany({ where: { caseId: id } }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "update",
        resourceType: "Case",
        resourceId: id,
      },
    }),
  ]);

  return NextResponse.json({ reopenLog, case: updatedCase });
}
