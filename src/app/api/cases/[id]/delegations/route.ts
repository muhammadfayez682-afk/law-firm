import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessCase,
  canDelegateTo,
  hasBaseCasePermission,
} from "@/lib/rbac";
import {
  ALL_DELEGATED_PERMISSIONS,
  DELEGATED_PERMISSION_LABELS_AR,
  DELEGATION_DEFAULT_EXPIRY_DAYS,
} from "@/lib/caseDelegation";
import { notify } from "@/lib/notifications/send";
import type { DelegatedPermission } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// تحميل موحّد للقضية بالحقول اللازمة لفحص الصلاحيات + التفويضات مع أسماء الأطراف.
function loadCase(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      team: { select: { userId: true } },
      accessOverrides: { select: { userId: true, accessType: true } },
      delegations: {
        orderBy: { createdAt: "desc" },
        include: {
          grantedBy: { select: { id: true, fullName: true, role: true } },
          grantedTo: { select: { id: true, fullName: true, role: true } },
        },
      },
    },
  });
}

/** قائمة تفويضات القضية مع إشارة إلى فعّاليتها الحالية. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canAccessCase(session.user, caseData)) return NextResponse.json({ error: "لا تملك صلاحية" }, { status: 403 });

  const now = Date.now();
  const delegations = caseData.delegations.map((d) => {
    const notRevoked = d.revokedAt == null;
    const notExpired = new Date(d.expiresAt).getTime() > now;
    // فعّال = غير ملغى + غير منتهٍ + المُفوِّض ما زال يملك الصلاحية بحكم وضعه المباشر.
    const granterStillHolds = hasBaseCasePermission(
      { id: d.grantedById, role: d.grantedBy.role },
      caseData,
      d.permission
    );
    const isEffective = notRevoked && notExpired && granterStillHolds;
    return {
      id: d.id,
      permission: d.permission,
      permissionLabel: DELEGATED_PERMISSION_LABELS_AR[d.permission],
      grantedToId: d.grantedToId,
      grantedToName: d.grantedTo.fullName,
      grantedByName: d.grantedBy.fullName,
      reason: d.reason,
      expiresAt: d.expiresAt.toISOString(),
      revokedAt: d.revokedAt?.toISOString() ?? null,
      isEffective,
      granterLostPermission: notRevoked && notExpired && !granterStillHolds,
    };
  });

  return NextResponse.json({ delegations });
}

/** إنشاء تفويض جديد. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (caseData.deletedAt) return NextResponse.json({ error: "القضية محذوفة" }, { status: 400 });

  const body = await request.json();
  const grantedToId: string = body.grantedToId;
  const permission = body.permission as DelegatedPermission;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!grantedToId || !permission) {
    return NextResponse.json({ error: "المستخدم والصلاحية مطلوبان" }, { status: 400 });
  }
  if (!ALL_DELEGATED_PERMISSIONS.includes(permission)) {
    return NextResponse.json({ error: "صلاحية غير معروفة" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "سبب التفويض إلزامي" }, { status: 400 });
  }
  if (grantedToId === session.user.id) {
    return NextResponse.json({ error: "لا يمكنك تفويض نفسك" }, { status: 400 });
  }

  // 1) المُفوِّض يجب أن يملك الصلاحية فعليًا بحكم وضعه المباشر (منع تصعيد الامتيازات).
  if (!hasBaseCasePermission(session.user, caseData, permission)) {
    return NextResponse.json(
      { error: "لا يمكنك تفويض صلاحية لا تملكها على هذه القضية" },
      { status: 403 }
    );
  }

  // 2) المفوَّض له: مستخدم نشط + ضمن سلسلة التفويض (أدنى) + بلا DENY صريح.
  const recipient = await prisma.user.findUnique({
    where: { id: grantedToId },
    select: { id: true, fullName: true, role: true, isActive: true },
  });
  if (!recipient || !recipient.isActive) {
    return NextResponse.json({ error: "المستخدم غير موجود أو معطّل" }, { status: 400 });
  }
  if (!canDelegateTo(session.user.role, recipient.role)) {
    return NextResponse.json(
      { error: "لا يمكن التفويض إلا لمن هو أدنى في سلسلة الصلاحيات (مشرف ← محامٍ/باحث)" },
      { status: 403 }
    );
  }
  if (caseData.accessOverrides.some((o) => o.userId === grantedToId && o.accessType === "deny")) {
    return NextResponse.json({ error: "لا يمكن التفويض لمستخدم ممنوع صراحةً من القضية" }, { status: 400 });
  }

  // 3) تاريخ الانتهاء (افتراضي = الآن + 30 يومًا).
  let expiresAt: Date;
  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "تاريخ انتهاء غير صالح (يجب أن يكون في المستقبل)" }, { status: 400 });
    }
  } else {
    expiresAt = new Date(Date.now() + DELEGATION_DEFAULT_EXPIRY_DAYS * 24 * 3600 * 1000);
  }

  const created = await prisma.permissionDelegation.create({
    data: {
      caseId: id,
      grantedById: session.user.id,
      grantedToId,
      permission,
      expiresAt,
      reason,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "PermissionDelegation", resourceId: created.id },
  });

  await notify({
    recipientId: grantedToId,
    type: "delegation_granted",
    priority: "high",
    title: "مُنحت تفويض صلاحية",
    message: `فُوّضت إليك «${DELEGATED_PERMISSION_LABELS_AR[permission]}» على القضية «${caseData.title}» حتى ${expiresAt.toISOString().slice(0, 10)}`,
    resourceType: "Case",
    resourceId: id,
    actionUrl: `/cases/${id}`,
    triggeredById: session.user.id,
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
