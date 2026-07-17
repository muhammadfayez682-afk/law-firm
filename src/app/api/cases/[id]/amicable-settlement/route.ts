import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canEditCase } from "@/lib/rbac";
import { computeDeadlineDate, getAmicableSettlementPlatform, getFirstStage } from "@/lib/caseFlow";
import { syncCaseDisplayNumber } from "@/lib/caseNumber.server";

type Params = { params: Promise<{ id: string }> };

async function loadCaseWithAccess(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: { team: true, accessOverrides: true, amicableSettlement: true },
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const caseData = await loadCaseWithAccess(id);

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canAccessCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذه القضية" }, { status: 403 });
  }

  if (!caseData.amicableSettlement) {
    return NextResponse.json({ error: "لا يوجد سجل تسوية لهذه القضية" }, { status: 404 });
  }

  return NextResponse.json(caseData.amicableSettlement);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const caseData = await loadCaseWithAccess(id);

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canEditCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه القضية" }, { status: 403 });
  }

  const platform = getAmicableSettlementPlatform(caseData.caseType);
  if (!platform) {
    return NextResponse.json(
      { error: "لا تنطبق مرحلة تسوية ودية على هذا النوع من القضايا" },
      { status: 400 }
    );
  }

  if (caseData.amicableSettlement) {
    return NextResponse.json({ error: "يوجد سجل تسوية بالفعل لهذه القضية" }, { status: 409 });
  }

  const firstStage = await getFirstStage(caseData.caseType);
  const body = await request.json().catch(() => ({}));

  const created = await prisma.amicableSettlement.create({
    data: {
      caseId: id,
      platform,
      isMandatory: firstStage?.isMandatory ?? false,
      requestNumber: body.requestNumber || null,
      mediatorName: body.mediatorName || null,
      firstSessionDate: body.firstSessionDate ? new Date(body.firstSessionDate) : null,
      deadlineDate: computeDeadlineDate(caseData.caseType),
      outcome: "pending",
    },
  });

  // إن رافق سجل التسوية رقم قوى/تراضي، قد يصبح هو الرقم المعروض (ما لم يوجد رقم محكمة).
  await syncCaseDisplayNumber(prisma, id);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "AmicableSettlement",
      resourceId: created.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const caseData = await loadCaseWithAccess(id);

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canEditCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه القضية" }, { status: 403 });
  }

  if (!caseData.amicableSettlement) {
    return NextResponse.json({ error: "لا يوجد سجل تسوية لهذه القضية" }, { status: 404 });
  }

  const body = await request.json();

  const updated = await prisma.amicableSettlement.update({
    where: { caseId: id },
    data: {
      outcome: body.outcome ?? undefined,
      requestNumber: body.requestNumber ?? undefined,
      mediatorName: body.mediatorName ?? undefined,
      firstSessionDate: body.firstSessionDate ? new Date(body.firstSessionDate) : undefined,
    },
  });

  // مزامنة حالة القضية مع نتيجة التسوية — لكل الحالات، لتفادي بقاء
  // "تمت التسوية" بعد تصحيح النتيجة إلى "فشلت" (خطأ قانوني خطير).
  if (body.outcome === "settled") {
    // نجاح التسوية: القضية تُحسم وديًا قبل المحكمة.
    await prisma.case.update({ where: { id }, data: { status: "settled_amicably" } });
  } else if (body.outcome === "failed") {
    // فشل التسوية: القضية تنتقل لمرحلة رفع الدعوى أمام المحكمة.
    await prisma.case.update({ where: { id }, data: { status: "open" } });
  } else if (body.outcome === "pending") {
    // إعادة الحالة إلى قيد التسوية الودية.
    await prisma.case.update({ where: { id }, data: { status: "amicable_settlement" } });
  }

  // إعادة حساب الرقم المعروض عند تغيّر رقم قوى/تراضي.
  if (body.requestNumber !== undefined) {
    await syncCaseDisplayNumber(prisma, id);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "AmicableSettlement",
      resourceId: updated.id,
    },
  });

  return NextResponse.json(updated);
}
