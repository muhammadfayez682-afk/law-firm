import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { CaseStatus, ClientType, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CLOSED_STATUSES: CaseStatus[] = ["closed", "archived"];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  const where: Prisma.ClientWhereInput = {
    ...(type ? { type: type as ClientType } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { nationalIdOrCr: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      cases: { select: { status: true } },
      _count: { select: { cases: true } },
    },
  });

  const withComputedStatus = clients.map((c) => ({
    ...c,
    isActive: c.cases.some((cs) => !CLOSED_STATUSES.includes(cs.status)),
  }));

  const filtered =
    status === "active"
      ? withComputedStatus.filter((c) => c.isActive)
      : status === "inactive"
        ? withComputedStatus.filter((c) => !c.isActive)
        : withComputedStatus;

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (session.user.role === "accountant") {
    return NextResponse.json({ error: "لا تملك صلاحية إضافة عملاء" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.fullName || !body.type) {
    return NextResponse.json({ error: "الحقول المطلوبة ناقصة" }, { status: 400 });
  }

  const created = await prisma.client.create({
    data: {
      type: body.type,
      fullName: body.fullName,
      nationalIdOrCr: body.nationalIdOrCr || null,
      nationality: body.nationality || null,
      representativeName: body.representativeName || null,
      phone: body.phone || null,
      email: body.email || null,
      status: body.status ?? "prospect",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Client",
      resourceId: created.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
