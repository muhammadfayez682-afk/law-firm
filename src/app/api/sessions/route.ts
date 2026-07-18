import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCase, caseVisibilityWhere } from "@/lib/rbac";
import { toHijri, formatDualDate } from "@/lib/dateUtils";
import { notifyBulk } from "@/lib/notifications/send";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const sessions = await prisma.session.findMany({
    where: {
      case: caseVisibilityWhere(session.user),
      ...(from || to
        ? {
            sessionDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { sessionDate: "asc" },
    include: { case: { include: { client: true } } },
  });

  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.caseId || !body.sessionType || !body.sessionDate) {
    return NextResponse.json({ error: "الحقول المطلوبة ناقصة" }, { status: 400 });
  }

  const caseData = await prisma.case.findUnique({
    where: { id: body.caseId },
    include: { team: true, accessOverrides: true },
  });

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canEditCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية جدولة جلسة لهذه القضية" }, { status: 403 });
  }

  // حظر جلسات المحكمة قبل صدور الوكالة — يُسمح فقط باجتماعات التسوية الودية.
  if (caseData.status === "pending_agency") {
    const AGENCY_FREE_SESSION_TYPES = ["negotiation_meeting"];
    if (!AGENCY_FREE_SESSION_TYPES.includes(body.sessionType)) {
      return NextResponse.json(
        {
          error: "agency_required",
          message: "لا يمكن جدولة جلسة محكمة قبل إصدار الوكالة الشرعية",
        },
        { status: 403 }
      );
    }
  }

  const sessionDate = new Date(body.sessionDate);

  const created = await prisma.session.create({
    data: {
      caseId: body.caseId,
      sessionType: body.sessionType,
      sessionDate,
      hijriDate: toHijri(sessionDate),
      court: body.court || null,
      reminderBefore: body.reminderBefore ? Number(body.reminderBefore) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Session",
      resourceId: created.id,
    },
  });

  // إشعار فريق القضية بجدولة الجلسة.
  const caseNo = caseData.displayNumber ?? caseData.internalNumber;
  const teamIds = [caseData.responsibleLawyerId, ...caseData.team.map((m) => m.userId)].filter(
    (uid) => uid !== session.user.id
  );
  await notifyBulk(teamIds, {
    type: "session_scheduled",
    priority: "normal",
    title: "جُدولت جلسة",
    message: `جلسة جديدة في القضية ${caseNo} بتاريخ ${formatDualDate(sessionDate)}.`,
    actionUrl: `/cases/${body.caseId}`,
    resourceType: "session",
    resourceId: created.id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(created, { status: 201 });
}
