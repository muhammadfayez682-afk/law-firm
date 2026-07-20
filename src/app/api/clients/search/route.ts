import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSaudiPhone } from "@/lib/validators";

const CLOSED_STATUSES = ["closed", "archived"] as const;

/**
 * بحث سريع عن عميل موجود (بالجوال/الهوية/الاسم) لاستخدامه في طلب الاستلام.
 * يُرجع بيانات العميل مع قضاياه النشطة وخدماته السابقة.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ clients: [] });

  const normalizedPhone = normalizeSaudiPhone(q);

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: normalizedPhone } },
        { nationalIdOrCr: { contains: q } },
      ],
    },
    take: 8,
    orderBy: { fullName: "asc" },
    include: {
      cases: {
        where: { status: { notIn: [...CLOSED_STATUSES] } },
        select: { id: true, internalNumber: true, displayNumber: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      },
      services: {
        select: { id: true, serviceNumber: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      nationalIdOrCr: c.nationalIdOrCr,
      type: c.type,
      email: c.email,
      activeCases: c.cases,
      services: c.services,
    })),
  });
}
