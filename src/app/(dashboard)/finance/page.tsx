import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvoices } from "@/lib/rbac";
import { SERVICE_STATUS_LABELS_AR } from "@/lib/services";
import { FinanceView } from "./FinanceView";

export default async function FinancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (!canManageInvoices(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        اللوحة المالية متاحة لمسؤول النظام والمحاسب فقط.
      </div>
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invoicesRaw, expensesRaw, servicesRaw, clients, cases] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      include: { client: true, case: { select: { id: true, title: true, internalNumber: true } } },
    }),
    prisma.expense.findMany({
      orderBy: { expenseDate: "desc" },
      include: {
        case: { select: { id: true, title: true, internalNumber: true } },
        recordedBy: { select: { fullName: true } },
      },
    }),
    prisma.legalService.findMany({
      where: { fee: { not: null } },
      orderBy: { updatedAt: "desc" },
      include: { client: { select: { fullName: true } } },
    }),
    prisma.client.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.case.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, internalNumber: true },
    }),
  ]);

  const invoices = invoicesRaw.map((inv) => {
    const amount = Number(inv.amount);
    const vatAmount = Number(inv.vatAmount);
    return {
      id: inv.id,
      clientName: inv.client.fullName,
      caseTitle: inv.case?.title ?? null,
      caseInternalNumber: inv.case?.internalNumber ?? null,
      amount,
      vatAmount,
      total: amount + vatAmount,
      status: inv.status,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      hasProof: inv.paymentProofKey != null,
    };
  });

  const expenses = expensesRaw.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    description: e.description,
    expenseDate: e.expenseDate.toISOString(),
    caseTitle: e.case.title,
    caseInternalNumber: e.case.internalNumber,
    recordedByName: e.recordedBy?.fullName ?? "—",
  }));

  const services = servicesRaw.map((s) => ({
    id: s.id,
    title: s.title,
    clientName: s.client.fullName,
    fee: s.fee != null ? Number(s.fee) : 0,
    statusLabel: SERVICE_STATUS_LABELS_AR[s.status] ?? s.status,
    isCompleted: s.status === "completed",
  }));

  // ===== المؤشرات =====
  const isOverdue = (i: (typeof invoices)[number]) =>
    i.status === "overdue" || (i.status === "due" && i.dueDate != null && new Date(i.dueDate) < now);
  const inMonth = (iso: string | null) => iso != null && new Date(iso) >= monthStart;

  const dueList = invoices.filter((i) => i.status === "due");
  const overdueList = invoices.filter(isOverdue);
  const collectedThisMonth = invoices
    .filter((i) => i.status === "paid" && inMonth(i.paidAt))
    .reduce((s, i) => s + i.total, 0);
  const expensesThisMonth = expenses.filter((e) => inMonth(e.expenseDate)).reduce((s, e) => s + e.amount, 0);

  const indicators = {
    dueTotal: dueList.reduce((s, i) => s + i.total, 0),
    dueCount: dueList.length,
    overdueTotal: overdueList.reduce((s, i) => s + i.total, 0),
    overdueCount: overdueList.length,
    collectedThisMonth,
    expensesThisMonth,
    net: collectedThisMonth - expensesThisMonth,
    serviceRevenue: services.filter((s) => s.isCompleted).reduce((sum, s) => sum + s.fee, 0),
    totalVat: invoices.reduce((s, i) => s + i.vatAmount, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">المركز المالي</h1>
        <p className="text-sm text-foreground/60">الفواتير والمصاريف وأتعاب الخدمات في مكان واحد</p>
      </div>

      <FinanceView
        indicators={indicators}
        invoices={invoices}
        expenses={expenses}
        services={services}
        clients={clients}
        cases={cases}
      />
    </div>
  );
}
