import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canAccessClient, isSystemAdmin } from "@/lib/rbac";

const PAGE_SIZE = 30;

/** هل يملك المستخدم صلاحية رؤية سجل تعديلات هذا الكيان؟ */
async function canViewEntityLog(
  user: { id: string; role: Parameters<typeof isSystemAdmin>[0] },
  entityType: string,
  entityId: string
): Promise<boolean> {
  const sessionUser = { id: user.id, role: user.role };
  if (entityType === "case") {
    const c = await prisma.case.findUnique({ where: { id: entityId }, include: { team: true, accessOverrides: true } });
    return !!c && canAccessCase(sessionUser, c);
  }
  if (entityType === "party") {
    const party = await prisma.caseParty.findUnique({
      where: { id: entityId },
      include: { case: { include: { team: true, accessOverrides: true } } },
    });
    return !!party && canAccessCase(sessionUser, party.case);
  }
  if (entityType === "client") {
    const client = await prisma.client.findUnique({
      where: { id: entityId },
      include: { cases: { include: { team: true, accessOverrides: true } } },
    });
    return !!client && canAccessClient(sessionUser, client);
  }
  if (entityType === "agency") {
    const agency = await prisma.agency.findUnique({
      where: { id: entityId },
      include: { client: { include: { cases: { include: { team: true, accessOverrides: true } } } } },
    });
    return !!agency && canAccessClient(sessionUser, agency.client);
  }
  // intake / memo: مقيّدة بالإدارة.
  return false;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const fieldName = searchParams.get("fieldName") ?? undefined;
  const reason = searchParams.get("reason") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const admin = isSystemAdmin(session.user.role);

  // غير المسؤول: يجب تحديد كيان يملك صلاحية رؤيته (لا سجل شامل).
  if (!admin) {
    if (!entityType || !entityId) {
      return NextResponse.json({ error: "سجل التعديلات الشامل متاح لمسؤول النظام فقط" }, { status: 403 });
    }
    const ok = await canViewEntityLog(session.user, entityType, entityId);
    if (!ok) {
      return NextResponse.json({ error: "لا تملك صلاحية عرض سجل تعديلات هذا الكيان" }, { status: 403 });
    }
  }

  const where: Prisma.EntityChangeLogWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(userId ? { changedById: userId } : {}),
    ...(fieldName ? { fieldName } : {}),
    ...(reason ? { changeReason: reason as Prisma.EntityChangeLogWhereInput["changeReason"] } : {}),
    ...(from || to
      ? { changedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.entityChangeLog.findMany({
      where,
      orderBy: { changedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { changedBy: { select: { fullName: true, role: true } } },
    }),
    prisma.entityChangeLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
