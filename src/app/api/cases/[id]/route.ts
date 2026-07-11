import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canEditCase, isManagement } from "@/lib/rbac";
import { canProceedToCourt } from "@/lib/caseFlow";

type Params = { params: Promise<{ id: string }> };

async function loadCaseForAccessCheck(id: string) {
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

  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      client: true,
      responsibleLawyer: true,
      parties: { include: { linkedClient: true } },
      team: { include: { user: true } },
      accessOverrides: true,
      documents: { include: { uploadedBy: true } },
      sessions: { orderBy: { sessionDate: "asc" }, include: { minutes: true } },
      invoices: true,
      expenses: true,
      amicableSettlement: true,
    },
  });

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canAccessCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذه القضية" }, { status: 403 });
  }

  return NextResponse.json(caseData);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await loadCaseForAccessCheck(id);

  if (!existing) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canEditCase(session.user, existing)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه القضية" }, { status: 403 });
  }

  const body = await request.json();

  const { title, status, priority, notes, courtName, courtCaseNumber, claimValue, outcome } = body;

  if (status === "open") {
    const check = await canProceedToCourt(existing.caseType, existing.amicableSettlement);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }
  }

  if (status === "closed" || status === "pending_closure") {
    return NextResponse.json(
      { error: "إغلاق القضية يتم فقط عبر نظام طلب الإغلاق والاعتماد" },
      { status: 400 }
    );
  }
  const hasDirectFieldUpdate =
    title !== undefined ||
    status !== undefined ||
    priority !== undefined ||
    notes !== undefined ||
    courtName !== undefined ||
    courtCaseNumber !== undefined ||
    claimValue !== undefined ||
    outcome !== undefined;

  const updated = await prisma.case.update({
    where: { id },
    data: hasDirectFieldUpdate
      ? {
          title,
          status,
          priority,
          notes,
          courtName,
          courtCaseNumber,
          claimValue: claimValue !== undefined ? Number(claimValue) : undefined,
          outcome,
          closedDate: status === "closed" || status === "archived" ? new Date() : undefined,
        }
      : {},
    include: { client: true, responsibleLawyer: true, amicableSettlement: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "Case",
      resourceId: id,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isManagement(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية أرشفة القضايا" }, { status: 403 });
  }

  const { id } = await params;

  const archived = await prisma.case.update({
    where: { id },
    data: { status: "archived", closedDate: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "delete",
      resourceType: "Case",
      resourceId: id,
    },
  });

  return NextResponse.json(archived);
}
