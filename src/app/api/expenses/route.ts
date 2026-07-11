import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvoices } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageInvoices(session.user.role)) {
    return NextResponse.json({ error: "المصاريف متاحة للشركاء والمحاسب فقط" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("caseId");

  const where: Prisma.ExpenseWhereInput = {
    ...(caseId ? { caseId } : {}),
  };

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: "desc" },
    include: {
      case: { select: { id: true, title: true, internalNumber: true } },
      recordedBy: { select: { fullName: true } },
    },
  });

  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canManageInvoices(session.user.role)) {
    return NextResponse.json({ error: "تسجيل المصاريف متاح للشركاء والمحاسب فقط" }, { status: 403 });
  }

  const body = await request.json();
  const amount = Number(body.amount);

  if (!body.caseId) {
    return NextResponse.json({ error: "القضية مطلوبة" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "مبلغ صحيح مطلوب" }, { status: 400 });
  }

  const created = await prisma.expense.create({
    data: {
      caseId: body.caseId,
      amount,
      description: typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
      recordedById: session.user.id,
    },
    include: {
      case: { select: { id: true, title: true, internalNumber: true } },
      recordedBy: { select: { fullName: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Expense",
      resourceId: created.id,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
