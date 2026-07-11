import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { InvoiceStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvoices } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: InvoiceStatus[] = ["due", "paid", "overdue"];

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageInvoices(session.user.role)) {
    return NextResponse.json({ error: "تعديل الفواتير متاح للشركاء والمحاسب فقط" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
  }

  const body = await request.json();
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
    },
    include: { client: true, case: { select: { id: true, title: true, internalNumber: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "Invoice",
      resourceId: id,
    },
  });

  return NextResponse.json(updated);
}
