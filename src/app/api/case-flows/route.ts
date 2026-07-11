import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManagement } from "@/lib/rbac";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const stages = await prisma.caseFlowStage.findMany({
    orderBy: [{ caseType: "asc" }, { order: "asc" }],
  });

  return NextResponse.json(stages);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isManagement(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية إدارة مسارات القضايا" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.caseType || !body.order || !body.key || !body.labelAr) {
    return NextResponse.json({ error: "الحقول المطلوبة ناقصة" }, { status: 400 });
  }

  try {
    const created = await prisma.caseFlowStage.create({
      data: {
        caseType: body.caseType,
        order: Number(body.order),
        key: body.key,
        labelAr: body.labelAr,
        isMandatory: Boolean(body.isMandatory),
        authority: body.authority || null,
        platformUrl: body.platformUrl || null,
        active: body.active ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "create",
        resourceType: "CaseFlowStage",
        resourceId: created.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "تعذّر إنشاء المرحلة — تحقق من عدم تكرار الترتيب لنفس نوع القضية" },
      { status: 400 }
    );
  }
}
