"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { InvoiceStatus } from "@prisma/client";
import { formatDualDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/formatNumber";

const VAT_RATE = 0.15;

type Invoice = {
  id: string;
  clientName: string;
  caseTitle: string | null;
  caseInternalNumber: string | null;
  amount: number;
  vatAmount: number;
  total: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
};

type Expense = {
  id: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  caseTitle: string;
  caseInternalNumber: string;
  recordedByName: string;
};

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  due: { label: "مستحقة", className: "bg-amber-100 text-amber-700" },
  paid: { label: "مدفوعة", className: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "متأخرة", className: "bg-red-100 text-red-700" },
};

const inputClass =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function InvoicesView({
  invoices,
  expenses,
  clients,
  cases,
  summary,
}: {
  invoices: Invoice[];
  expenses: Expense[];
  clients: { id: string; fullName: string }[];
  cases: { id: string; title: string; internalNumber: string }[];
  summary: { totalDue: number; totalPaid: number; overdueTotal: number };
}) {
  const [tab, setTab] = useState<"invoices" | "expenses">("invoices");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-black/10">
        <TabButton active={tab === "invoices"} onClick={() => setTab("invoices")}>
          الفواتير
        </TabButton>
        <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")}>
          المصاريف
        </TabButton>
      </div>

      {tab === "invoices" ? (
        <InvoicesTab invoices={invoices} clients={clients} cases={cases} summary={summary} />
      ) : (
        <ExpensesTab expenses={expenses} cases={cases} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active ? "border-gold text-navy" : "border-transparent text-foreground/50 hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}

function InvoicesTab({
  invoices,
  clients,
  cases,
  summary,
}: {
  invoices: Invoice[];
  clients: { id: string; fullName: string }[];
  cases: { id: string; title: string; internalNumber: string }[];
  summary: { totalDue: number; totalPaid: number; overdueTotal: number };
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        if (statusFilter && inv.status !== statusFilter) return false;
        if (clientFilter && inv.clientName !== clientFilter) return false;
        if (q && !inv.clientName.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [invoices, q, statusFilter, clientFilter]
  );

  async function markPaid(id: string) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "تعذّر تحديث الفاتورة.");
      return;
    }
    toast.success("تم تحديد الفاتورة كمدفوعة");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="إجمالي المستحق" value={summary.totalDue} accent="border-r-amber-400" />
        <SummaryCard label="إجمالي المدفوع" value={summary.totalPaid} accent="border-r-emerald-500" />
        <SummaryCard label="المتأخرات" value={summary.overdueTotal} accent="border-r-red-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم العميل..."
          className="min-w-[200px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white"
        >
          <option value="">كل الحالات</option>
          <option value="due">مستحقة</option>
          <option value="paid">مدفوعة</option>
          <option value="overdue">متأخرة</option>
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold bg-white"
        >
          <option value="">كل العملاء</option>
          {clients.map((c) => (
            <option key={c.id} value={c.fullName}>
              {c.fullName}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="mr-auto rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + فاتورة جديدة
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">رقم الفاتورة</th>
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">القضية</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">الضريبة</th>
                <th className="px-4 py-3">الإجمالي</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الإصدار</th>
                <th className="px-4 py-3">الاستحقاق</th>
                <th className="px-4 py-3">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                  <td className="px-4 py-3 font-mono text-xs text-foreground/60" dir="ltr">
                    {inv.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">{inv.clientName}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {inv.caseInternalNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3 text-foreground/70">{formatCurrency(inv.vatAmount)}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${INVOICE_STATUS_CONFIG[inv.status].className}`}
                    >
                      {INVOICE_STATUS_CONFIG[inv.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">
                    {formatDualDate(inv.issueDate)}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">
                    {inv.dueDate ? formatDualDate(inv.dueDate) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {inv.status !== "paid" && (
                      <button
                        type="button"
                        onClick={() => markPaid(inv.id)}
                        className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        تحديد كمدفوعة
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-foreground/50">
                    لا توجد فواتير
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewInvoiceModal clients={clients} cases={cases} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}

function ExpensesTab({
  expenses,
  cases,
}: {
  expenses: Expense[];
  cases: { id: string; title: string; internalNumber: string }[];
}) {
  const [showNew, setShowNew] = useState(false);

  const totalsByCase = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.caseInternalNumber, (map.get(e.caseInternalNumber) ?? 0) + e.amount);
    }
    return Array.from(map.entries());
  }, [expenses]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + مصروف جديد
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">القضية</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">الوصف</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">من سجّلها</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{e.caseTitle}</p>
                    <p className="text-xs text-foreground/40">{e.caseInternalNumber}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-foreground/70">{e.description ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">
                    {formatDualDate(e.expenseDate)}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{e.recordedByName}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-foreground/50">
                    لا توجد مصاريف مسجّلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalsByCase.length > 0 && (
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">إجمالي مصاريف كل قضية</h2>
          <ul className="space-y-2 text-sm">
            {totalsByCase.map(([caseNo, total]) => (
              <li key={caseNo} className="flex items-center justify-between">
                <span className="text-foreground/70">{caseNo}</span>
                <span className="font-semibold text-navy">{formatCurrency(total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showNew && <NewExpenseModal cases={cases} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border border-black/5 border-r-4 ${accent} bg-white p-5 shadow-sm`}>
      <p className="text-sm text-foreground/50">{label}</p>
      <p className="mt-2 font-amiri text-2xl font-bold text-navy">{formatCurrency(value)}</p>
    </div>
  );
}

function NewInvoiceModal({
  clients,
  cases,
  onClose,
}: {
  clients: { id: string; fullName: string }[];
  cases: { id: string; title: string; internalNumber: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("");

  const computedVat = amount ? (Number(amount) * VAT_RATE).toFixed(2) : "";
  const effectiveVat = vat !== "" ? vat : computedVat;
  const total =
    amount && effectiveVat ? Number(amount) + Number(effectiveVat) : Number(amount || 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      clientId: formData.get("clientId"),
      caseId: formData.get("caseId") || null,
      amount: Number(amount),
      vatAmount: vat !== "" ? Number(vat) : undefined,
      dueDate: formData.get("dueDate") || null,
    };
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر إنشاء الفاتورة.");
        return;
      }
      toast.success("تم إنشاء الفاتورة");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="فاتورة جديدة" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>العميل</label>
          <select name="clientId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              اختر العميل
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>القضية (اختياري)</label>
          <select name="caseId" defaultValue="" className={inputClass}>
            <option value="">بدون قضية</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.internalNumber} — {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>المبلغ (ر.س)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={inputClass}
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelClass}>ضريبة القيمة المضافة</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={effectiveVat}
              onChange={(e) => setVat(e.target.value)}
              placeholder="15% تلقائيًا"
              className={inputClass}
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>تاريخ الاستحقاق</label>
          <input name="dueDate" type="date" className={inputClass} dir="ltr" />
        </div>
        <p className="rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy">
          الإجمالي: <span className="font-semibold">{formatCurrency(total)}</span>
        </p>
        <ModalActions loading={loading} submitLabel="إنشاء الفاتورة" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function NewExpenseModal({
  cases,
  onClose,
}: {
  cases: { id: string; title: string; internalNumber: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      caseId: formData.get("caseId"),
      amount: Number(formData.get("amount")),
      description: formData.get("description") || null,
      expenseDate: formData.get("expenseDate") || null,
    };
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تسجيل المصروف.");
        return;
      }
      toast.success("تم تسجيل المصروف");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="مصروف جديد" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>القضية</label>
          <select name="caseId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              اختر القضية
            </option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.internalNumber} — {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>المبلغ (ر.س)</label>
            <input name="amount" type="number" step="0.01" min="0" required className={inputClass} dir="ltr" />
          </div>
          <div>
            <label className={labelClass}>التاريخ</label>
            <input name="expenseDate" type="date" className={inputClass} dir="ltr" />
          </div>
        </div>
        <div>
          <label className={labelClass}>الوصف</label>
          <input name="description" className={inputClass} />
        </div>
        <ModalActions loading={loading} submitLabel="تسجيل المصروف" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  loading,
  submitLabel,
  onClose,
}: {
  loading: boolean;
  submitLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5"
      >
        إلغاء
      </button>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
      >
        {loading ? "جارٍ الحفظ..." : submitLabel}
      </button>
    </div>
  );
}
