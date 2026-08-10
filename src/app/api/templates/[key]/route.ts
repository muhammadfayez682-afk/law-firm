import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { canAccessIntake } from "@/lib/intake";
import { getTemplateDefinition, isIntakeEligibleTemplate, firstMissingRequiredField } from "@/lib/templates/definitions";
import {
  SESSION_REPORT_KEY,
  findEarliestHeldSessionMissingReport,
  notifySessionReportRequired,
  reportBlockedMessage,
} from "@/lib/sessionReport";

type Params = { params: Promise<{ key: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { key } = await params;
  const definition = getTemplateDefinition(key);

  if (!definition || definition.staticPdfPath) {
    return NextResponse.json({ error: "النموذج غير موجود" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const intakeId: string | null = body.intakeId || null;
  const caseId: string | null = intakeId ? null : body.caseId || null;
  const sessionId: string | null = body.sessionId || null;
  const data = body.data ?? {};

  if (intakeId && !isIntakeEligibleTemplate(definition)) {
    return NextResponse.json({ error: "هذا النموذج لا يُعبّأ في مرحلة الاستلام" }, { status: 400 });
  }
  if (!intakeId && definition.linkedTo === "case" && !caseId) {
    return NextResponse.json({ error: "اختيار القضية إلزامي لهذا النموذج" }, { status: 400 });
  }
  if (definition.linkedTo === "case_session" && (!caseId || !sessionId)) {
    return NextResponse.json({ error: "اختيار القضية والجلسة إلزامي لهذا النموذج" }, { status: 400 });
  }

  if (intakeId) {
    const intake = await prisma.intakeRequest.findUnique({
      where: { id: intakeId },
      select: { id: true, receivedById: true },
    });
    if (!intake) return NextResponse.json({ error: "طلب الاستلام غير موجود" }, { status: 404 });
    if (!canAccessIntake(session.user, intake)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لطلب الاستلام" }, { status: 403 });
    }
  }

  if (caseId) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { team: true, accessOverrides: true },
    });
    if (!caseData) {
      return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
    }
    if (!canAccessCase(session.user, caseData)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذه القضية" }, { status: 403 });
    }
  }

  // تحقق الحقول الإلزامية (مثل «ملخص الجلسة» في تقرير الجلسة) — يُفرض على الـ API لا الواجهة فقط.
  const missing = firstMissingRequiredField(definition, data);
  if (missing) {
    return NextResponse.json(
      { error: `حقل «${missing.label}» إلزامي — لا يمكن حفظ النموذج دون تعبئته.` },
      { status: 400 }
    );
  }

  // القيد التسلسلي الزمني: لا يُكتب تقرير جلسة ما دامت جلسة منعقدة أسبق زمنيًا بلا تقرير مكتمل.
  if (definition.key === SESSION_REPORT_KEY && sessionId) {
    const thisSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, caseId: true, sessionDate: true },
    });
    if (thisSession) {
      const blocker = await findEarliestHeldSessionMissingReport(prisma, thisSession.caseId, {
        beforeDate: thisSession.sessionDate,
        excludeSessionId: thisSession.id,
      });
      if (blocker) {
        await notifySessionReportRequired(prisma, thisSession.caseId, blocker, session.user.id);
        return NextResponse.json({ error: reportBlockedMessage(blocker) }, { status: 400 });
      }
    }
  }

  const created = await prisma.filledTemplate.create({
    data: {
      templateKey: key,
      caseId,
      intakeId,
      sessionId,
      filledBy: session.user.id,
      data,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "FilledTemplate",
      resourceId: created.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
