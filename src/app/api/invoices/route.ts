import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvoices } from "@/lib/rbac";

const VAT_RATE = 0.15;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageInvoices(session.user.role)) {
    return NextResponse.json({ error: "الفواتير متاحة للشركاء والمحاسب فقط" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const where: Prisma.InvoiceWhereInput = {
    ...(status ? { status: status as InvoiceStatus } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q ? { client: { fullName: { contains: q, mode: "insensitive" } } } : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { issueDate: "desc" },
    include: { client: true, case: { select: { id: true, title: true, internalNumber: true } } },
  });

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageInvoices(session.user.role)) {
    return NextResponse.json({ error: "إنشاء الفواتير متاح للشركاء والمحاسب فقط" }, { status: 403 });
  }

  const body = await request.json();
  const amount = Number(body.amount);

  if (!body.clientId) {
    return NextResponse.json({ error: "العميل مطلوب" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "مبلغ صحيح مطلوب" }, { status: 400 });
  }

  const vatAmount =
    body.vatAmount !== undefined && body.vatAmount !== null && body.vatAmount !== ""
      ? Number(body.vatAmount)
      : Math.round(amount * VAT_RATE * 100) / 100;

  const created = await prisma.invoice.create({
    data: {
      clientId: body.clientId,
      caseId: body.caseId || null,
      amount,
      vatAmount,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: "due",
    },
    include: { client: true, case: { select: { id: true, title: true, internalNumber: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Invoice",
      resourceId: created.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
