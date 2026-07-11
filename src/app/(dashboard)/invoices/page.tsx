import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvoices } from "@/lib/rbac";
import { InvoicesView } from "./InvoicesView";

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (!canManageInvoices(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        صفحة الفواتير والمصاريف متاحة للشركاء والمحاسب فقط.
      </div>
    );
  }

  const [invoicesRaw, expensesRaw, clients, cases] = await Promise.all([
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

  const totalDue = invoices
    .filter((i) => i.status === "due" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);
  const overdueTotal = invoices
    .filter((i) => i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">الفواتير والمصاريف</h1>
        <p className="text-sm text-foreground/60">الإدارة المالية للمكتب</p>
      </div>

      <InvoicesView
        invoices={invoices}
        expenses={expenses}
        clients={clients}
        cases={cases}
        summary={{ totalDue, totalPaid, overdueTotal }}
      />
    </div>
  );
}
