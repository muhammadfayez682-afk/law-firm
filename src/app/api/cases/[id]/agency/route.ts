import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { AgencyType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCase } from "@/lib/rbac";
import { isValidAgencyNumber, VALIDATION_MESSAGES } from "@/lib/validators";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** إضافة الوكالة لقضية (تفعيلها الكامل) — تُنشئ Agency وتنقل الحالة من pending_agency. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const caseData = await prisma.case.findUnique({
    where: { id },
    include: { team: true, accessOverrides: true },
  });
  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }
  if (!canEditCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه القضية" }, { status: 403 });
  }

  const body = await request.json();
  const agencyNumber = typeof body.agencyNumber === "string" ? body.agencyNumber.trim() : "";
  const issueDate = body.issueDate ? new Date(body.issueDate) : null;
  const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;

  if (!agencyNumber || !isValidAgencyNumber(agencyNumber)) {
    return NextResponse.json({ error: VALIDATION_MESSAGES.agency }, { status: 400 });
  }
  if (!issueDate || Number.isNaN(issueDate.getTime())) {
    return NextResponse.json({ error: "تاريخ إصدار الوكالة مطلوب" }, { status: 400 });
  }
  // الانتهاء الافتراضي: بعد سنة من الإصدار إن لم يُحدَّد.
  const expiry =
    expiryDate && !Number.isNaN(expiryDate.getTime())
      ? expiryDate
      : new Date(issueDate.getFullYear() + 1, issueDate.getMonth(), issueDate.getDate());

  const wasPending = caseData.status === "pending_agency";

  const agency = await prisma.$transaction(async (tx) => {
    const created = await tx.agency.create({
      data: {
        clientId: caseData.clientId,
        agencyNumber,
        agencyType: (body.agencyType as AgencyType) || "general",
        scopeText: typeof body.scopeText === "string" && body.scopeText.trim() ? body.scopeText.trim() : "غير محدد",
        issueDate,
        expiryDate: expiry,
      },
    });
    // نقل القضية للعمل الكامل فقط إن كانت قيد إصدار الوكالة.
    if (wasPending) {
      await tx.case.update({ where: { id }, data: { status: "in_progress" } });
    }
    return created;
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "Agency", resourceId: agency.id },
  });

  // إشعار فريق القضية بصدور الوكالة (القضية صارت نشطة كاملة).
  if (wasPending) {
    const teamIds = [caseData.responsibleLawyerId, ...caseData.team.map((m) => m.userId)].filter(
      (uid) => uid !== session.user.id
    );
    await notifyBulk(teamIds, {
      type: "agency_issued",
      priority: "normal",
      title: "صدرت الوكالة — القضية نشطة كاملة",
      message: `صدرت الوكالة للقضية ${caseData.displayNumber ?? caseData.internalNumber}؛ يمكن الآن جدولة جلسات المحكمة.`,
      actionUrl: `/cases/${id}`,
      resourceType: "Case",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ agency, status: wasPending ? "in_progress" : caseData.status }, { status: 201 });
}
