import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, resolveCasePermission, casePermissionInclude } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

/** تحميل القضية بما يلزم فحص صلاحية manage_timeline (يشمل createdById الحقلي). */
function loadCase(id: string) {
  return prisma.case.findUnique({ where: { id }, include: casePermissionInclude });
}

/** أحداث التسلسل الزمني مرتبة بالتسلسل — لكل من يملك رؤية القضية. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canAccessCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع" }, { status: 403 });
  }

  const events = await prisma.caseTimelineEvent.findMany({
    where: { caseId: id },
    orderBy: { sequence: "asc" },
    include: { createdBy: { select: { fullName: true } } },
  });
  return NextResponse.json({ events, canManage: resolveCasePermission(session.user, caseData, "manage_timeline").allowed });
}

/** إضافة إجراء يدوي (sequence = آخر+1) — يخضع لـ manage_timeline. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (caseData.deletedAt) return NextResponse.json({ error: "القضية محذوفة" }, { status: 400 });

  const perm = resolveCasePermission(session.user, caseData, "manage_timeline");
  if (!perm.allowed) {
    return NextResponse.json({ error: "لا تملك صلاحية إدارة التسلسل الزمني لهذه القضية" }, { status: 403 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "عنوان الإجراء مطلوب" }, { status: 400 });

  const last = await prisma.caseTimelineEvent.findFirst({
    where: { caseId: id },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  const eventDate = body.eventDate ? new Date(body.eventDate) : null;

  const created = await prisma.caseTimelineEvent.create({
    data: {
      caseId: id,
      sequence: (last?.sequence ?? 0) + 1,
      title,
      content: typeof body.content === "string" && body.content.trim() ? body.content.trim() : null,
      eventDate: eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null,
      source: "manual",
      createdById: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "CaseTimelineEvent",
      resourceId: created.id,
      viaDelegation: perm.viaDelegation,
    },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
