import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTeamMembers, TeamValidationError, TEAM_ROLE_LABELS_AR, type TeamInput } from "@/lib/caseTeam";
import { notify } from "@/lib/notifications/send";
import { resolveCasePermission } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

/** تعديل تشكيل فريق القضية — صلاحية manage_team أساسية (مسؤول/مشرف بوصول) أو تفويض فعّال. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      team: true,
      accessOverrides: { select: { userId: true, accessType: true } },
      delegations: {
        select: {
          grantedToId: true,
          grantedById: true,
          permission: true,
          revokedAt: true,
          expiresAt: true,
          grantedBy: { select: { role: true } },
        },
      },
    },
  });
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (caseData.deletedAt) return NextResponse.json({ error: "القضية محذوفة" }, { status: 400 });

  const teamPerm = resolveCasePermission(session.user, caseData, "manage_team");
  if (!teamPerm.allowed) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل فريق هذه القضية" }, { status: 403 });
  }

  const body = await request.json();
  const teamInput: TeamInput = {
    supervisorId: body.team?.supervisorId ?? null,
    leadLawyerId: body.team?.leadLawyerId,
    coLawyerIds: Array.isArray(body.team?.coLawyerIds) ? body.team.coLawyerIds : [],
    researcherIds: Array.isArray(body.team?.researcherIds) ? body.team.researcherIds : [],
  };

  let members;
  try {
    members = buildTeamMembers(teamInput);
  } catch (e) {
    const msg = e instanceof TeamValidationError ? e.message : "تشكيل الفريق غير صالح";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const oldIds = new Set(caseData.team.map((m) => m.userId));
  const newIds = new Set(members.map((m) => m.userId));
  const addedIds = members.filter((m) => !oldIds.has(m.userId)).map((m) => m.userId);
  const removedIds = [...oldIds].filter((uid) => !newIds.has(uid));

  // إعادة بناء الفريق بالكامل داخل معاملة + مزامنة المحامي الرئيسي.
  await prisma.$transaction(async (tx) => {
    await tx.caseTeamMember.deleteMany({ where: { caseId: id } });
    await tx.caseTeamMember.createMany({
      data: members.map((m) => ({ caseId: id, userId: m.userId, roleInCase: m.roleInCase })),
    });
    await tx.case.update({ where: { id }, data: { responsibleLawyerId: teamInput.leadLawyerId } });
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "Case",
      resourceId: id,
      viaDelegation: teamPerm.viaDelegation,
    },
  });

  const roleOf = new Map(members.map((m) => [m.userId, m.roleInCase]));

  // إشعار المُضافين بدورهم.
  for (const uid of addedIds) {
    if (uid === session.user.id) continue;
    await notify({
      recipientId: uid,
      type: "case_assigned",
      title: "أُسندت إليك قضية",
      message: `${caseData.title} — دورك: ${TEAM_ROLE_LABELS_AR[roleOf.get(uid)!]}`,
      resourceType: "Case",
      resourceId: id,
      actionUrl: `/cases/${id}`,
      triggeredById: session.user.id,
    });
  }

  // إشعار المُزالين.
  for (const uid of removedIds) {
    if (uid === session.user.id) continue;
    await notify({
      recipientId: uid,
      type: "case_team_updated",
      title: "أُزلت من فريق قضية",
      message: `لم تعد عضوًا في فريق القضية «${caseData.title}»`,
      resourceType: "Case",
      resourceId: id,
      actionUrl: `/cases/${id}`,
      triggeredById: session.user.id,
    });
  }

  // إشعار بقية الفريق بتغيّر التشكيل (عند وجود إضافة أو إزالة فعلية).
  if (addedIds.length || removedIds.length) {
    const remainingIds = members
      .map((m) => m.userId)
      .filter((uid) => !addedIds.includes(uid) && uid !== session.user.id);
    for (const uid of remainingIds) {
      await notify({
        recipientId: uid,
        type: "case_team_updated",
        title: "تغيّر تشكيل فريق القضية",
        message: `تحدّث فريق القضية «${caseData.title}»`,
        resourceType: "Case",
        resourceId: id,
        actionUrl: `/cases/${id}`,
        triggeredById: session.user.id,
      });
    }
  }

  return NextResponse.json({ ok: true, memberCount: members.length });
}
