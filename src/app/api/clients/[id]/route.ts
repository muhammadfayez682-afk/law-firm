import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      agencies: { orderBy: { expiryDate: "asc" } },
      cases: {
        orderBy: { createdAt: "desc" },
        include: { responsibleLawyer: true, team: true, accessOverrides: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
  }

  if (!canAccessClient(session.user, client)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذا العميل" }, { status: 403 });
  }

  return NextResponse.json(client);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (session.user.role === "accountant") {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل بيانات العملاء" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.client.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
  }

  const body = await request.json();

  const updated = await prisma.client.update({
    where: { id },
    data: {
      fullName: body.fullName ?? undefined,
      nationalIdOrCr: body.nationalIdOrCr ?? undefined,
      nationality: body.nationality ?? undefined,
      representativeName: body.representativeName ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      status: body.status ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "Client",
      resourceId: id,
    },
  });

  return NextResponse.json(updated);
}
