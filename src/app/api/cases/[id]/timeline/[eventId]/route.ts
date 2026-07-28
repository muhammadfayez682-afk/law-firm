import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCasePermission, casePermissionInclude } from "@/lib/rbac";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string; eventId: string }> };

async function loadCaseAndEvent(id: string, eventId: string) {
  const [caseData, event] = await Promise.all([
    prisma.case.findUnique({ where: { id }, include: casePermissionInclude }),
    prisma.caseTimelineEvent.findUnique({ where: { id: eventId } }),
  ]);
  return { caseData, event };
}

/** تعديل حدث (title/content/eventDate) — يخضع لـ manage_timeline. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, eventId } = await params;
  const { caseData, event } = await loadCaseAndEvent(id, eventId);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!event || event.caseId !== id) return NextResponse.json({ error: "الحدث غير موجود" }, { status: 404 });

  const perm = resolveCasePermission(session.user, caseData, "manage_timeline");
  if (!perm.allowed) {
    return NextResponse.json({ error: "لا تملك صلاحية إدارة التسلسل الزمني لهذه القضية" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.content !== undefined) {
    data.content = typeof body.content === "string" && body.content.trim() ? body.content.trim() : null;
  }
  if (body.eventDate !== undefined) {
    if (body.eventDate) {
      const d = new Date(body.eventDate);
      data.eventDate = Number.isNaN(d.getTime()) ? null : d;
    } else {
      data.eventDate = null;
    }
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "لا تغييرات" }, { status: 400 });

  const updated = await prisma.caseTimelineEvent.update({ where: { id: eventId }, data });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "CaseTimelineEvent",
      resourceId: eventId,
      viaDelegation: perm.viaDelegation,
    },
  });

  // إشعار الفريق عند اكتمال محتوى الحدث لأول مرة (محتوى + تاريخ).
  const wasComplete = event.content != null && event.eventDate != null;
  const nowComplete = updated.content != null && updated.eventDate != null;
  if (!wasComplete && nowComplete) {
    const recipients = [
      caseData.responsibleLawyerId,
      ...caseData.team.map((t) => t.userId),
    ].filter((uid, i, arr) => uid !== session.user.id && arr.indexOf(uid) === i);
    await notifyBulk(recipients, {
      type: "timeline_event_updated",
      title: "اكتمل حدث في التسلسل الزمني",
      message: `اكتمل الحدث «${updated.title}» في التسلسل الزمني للقضية.`,
      actionUrl: `/cases/${id}`,
      resourceType: "Case",
      resourceId: id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ ok: true });
}

/** حذف حدث — الأحداث اليدوية فقط (أحداث القالب لا تُحذف) — يخضع لـ manage_timeline. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, eventId } = await params;
  const { caseData, event } = await loadCaseAndEvent(id, eventId);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!event || event.caseId !== id) return NextResponse.json({ error: "الحدث غير موجود" }, { status: 404 });

  const perm = resolveCasePermission(session.user, caseData, "manage_timeline");
  if (!perm.allowed) {
    return NextResponse.json({ error: "لا تملك صلاحية إدارة التسلسل الزمني لهذه القضية" }, { status: 403 });
  }
  if (event.source === "template") {
    return NextResponse.json({ error: "أحداث القالب المبدئي لا تُحذف" }, { status: 400 });
  }

  await prisma.caseTimelineEvent.delete({ where: { id: eventId } });
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "delete",
      resourceType: "CaseTimelineEvent",
      resourceId: eventId,
      viaDelegation: perm.viaDelegation,
    },
  });

  return NextResponse.json({ ok: true });
}
