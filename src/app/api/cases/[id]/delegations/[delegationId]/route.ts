import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { DELEGATED_PERMISSION_LABELS_AR } from "@/lib/caseDelegation";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string; delegationId: string }> };

/** إلغاء تفويض — المُفوِّض نفسه، أو مسؤول النظام/المشرف صاحب صلاحية على القضية. */
export async function PATCH(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, delegationId } = await params;

  const delegation = await prisma.permissionDelegation.findUnique({
    where: { id: delegationId },
    include: {
      case: {
        include: {
          team: { select: { userId: true } },
          accessOverrides: { select: { userId: true, accessType: true } },
          delegations: { select: { grantedToId: true, revokedAt: true, expiresAt: true } },
        },
      },
    },
  });
  if (!delegation || delegation.caseId !== id) {
    return NextResponse.json({ error: "التفويض غير موجود" }, { status: 404 });
  }
  if (delegation.revokedAt) {
    return NextResponse.json({ error: "التفويض ملغى مسبقًا" }, { status: 400 });
  }

  const isGranter = delegation.grantedById === session.user.id;
  const isManager =
    (session.user.role === "system_admin" || session.user.role === "supervisor") &&
    canAccessCase(session.user, delegation.case);
  if (!isGranter && !isManager) {
    return NextResponse.json({ error: "لا تملك صلاحية إلغاء هذا التفويض" }, { status: 403 });
  }

  await prisma.permissionDelegation.update({
    where: { id: delegationId },
    data: { revokedAt: new Date(), revokedById: session.user.id },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "PermissionDelegation", resourceId: delegationId },
  });

  if (delegation.grantedToId !== session.user.id) {
    await notify({
      recipientId: delegation.grantedToId,
      type: "delegation_revoked",
      title: "أُلغي تفويض صلاحية",
      message: `أُلغي تفويض «${DELEGATED_PERMISSION_LABELS_AR[delegation.permission]}» على القضية «${delegation.case.title}»`,
      resourceType: "Case",
      resourceId: id,
      actionUrl: `/cases/${id}`,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
