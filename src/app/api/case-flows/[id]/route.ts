import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManagement } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isManagement(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية إدارة مسارات القضايا" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.caseFlowStage.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "المرحلة غير موجودة" }, { status: 404 });
  }

  const body = await request.json();

  try {
    const updated = await prisma.caseFlowStage.update({
      where: { id },
      data: {
        order: body.order !== undefined ? Number(body.order) : undefined,
        key: body.key ?? undefined,
        labelAr: body.labelAr ?? undefined,
        isMandatory: body.isMandatory !== undefined ? Boolean(body.isMandatory) : undefined,
        authority: body.authority !== undefined ? body.authority || null : undefined,
        platformUrl: body.platformUrl !== undefined ? body.platformUrl || null : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "update",
        resourceType: "CaseFlowStage",
        resourceId: id,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "تعذّر تحديث المرحلة — تحقق من عدم تكرار الترتيب لنفس نوع القضية" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isManagement(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية إدارة مسارات القضايا" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.caseFlowStage.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "المرحلة غير موجودة" }, { status: 404 });
  }

  await prisma.caseFlowStage.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "delete",
      resourceType: "CaseFlowStage",
      resourceId: id,
    },
  });

  return NextResponse.json({ success: true });
}
