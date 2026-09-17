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
  paidAt: string | null;
  hasProof: boolean;
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
type Service = { id: string; title: string; clientName: string; fee: number; statusLabel: string; isCompleted: boolean };
type Indicators = {
  dueTotal: number; dueCount: number;
  overdueTotal: number; overdueCount: number;
  collectedThisMonth: number; expensesThisMonth: number; net: number;
  serviceRevenue: number; totalVat: number;
};
type OptClient = { id: string; fullName: string };
type OptCase = { id: string; title: string; internalNumber: string };

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  due: { label: "مستحقة", className: "bg-amber-100 text-amber-700" },
  paid: { label: "مدفوعة", className: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "متأخرة", className: "bg-red-100 text-red-700" },
};

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function FinanceView({
  indicators,
  invoices,
  expenses,
  services,
  clients,
  cases,
}: {
  indicators: Indicators;
  invoices: Invoice[];
  expenses: Expense[];
  services: Service[];
  clients: OptClient[];
  cases: OptCase[];
}) {
  const [tab, setTab] = useState<"invoices" | "expenses" | "services">("invoices");
  const [modal, setModal] = useState<null | "invoice" | "expense">(null);

  return (
    <div className="space-y-6">
      {/* ===== المؤشرات الرئيسية ===== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <IndicatorCard
          icon="🧾" tone="amber" label="مستحق (غير محصّل)"
          value={indicators.dueTotal} sub={`${indicators.dueCount} فاتورة`}
        />
        <IndicatorCard
          icon="⚠️" tone="red" label="متأخر"
          value={indicators.overdueTotal} sub={`${indicators.overdueCount} فاتورة`}
        />
        <IndicatorCard
          icon="📈" tone="emerald" label="صافي هذا الشهر"
          value={indicators.net} sub="المحصّل − المصاريف"
        />
      </div>

      {/* ===== شريط ثانوي ===== */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-[13px] shadow-sm">
        <SecondaryStat label="محصّل هذا الشهر" value={indicators.collectedThisMonth} />
        <Dot /><SecondaryStat label="مصاريف الشهر" value={indicators.expensesThisMonth} />
        <Dot /><SecondaryStat label="أتعاب الخدمات (مكتملة)" value={indicators.serviceRevenue} />
        <Dot /><SecondaryStat label="إجمالي ضريبة القيمة المضافة" value={indicators.totalVat} />
      </div>

      {/* ===== أزرار الإنشاء + التبويبات ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 border-b border-black/10">
          <TabButton active={tab === "invoices"} onClick={() => setTab("invoices")}>الفواتير</TabButton>
          <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")}>المصاريف</TabButton>
          <TabButton active={tab === "services"} onClick={() => setTab("services")}>أتعاب الخدمات</TabButton>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModal("invoice")} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            + فاتورة جديدة
          </button>
          <button type="button" onClick={() => setModal("expense")} className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5">
            + مصروف
          </button>
        </div>
      </div>

      {tab === "invoices" && <InvoicesTab invoices={invoices} />}
      {tab === "expenses" && <ExpensesTab expenses={expenses} />}
      {tab === "services" && <ServicesTab services={services} />}

      {modal === "invoice" && <NewInvoiceModal clients={clients} cases={cases} onClose={() => setModal(null)} />}
      {modal === "expense" && <NewExpenseModal cases={cases} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ═══════════ المؤشرات ═══════════ */
const CARD_TONES: Record<"amber" | "red" | "emerald", { box: string; num: string }> = {
  amber: { box: "border-amber-200 bg-amber-50", num: "text-amber-700" },
  red: { box: "border-red-200 bg-red-50", num: "text-red-700" },
  emerald: { box: "border-emerald-200 bg-emerald-50", num: "text-emerald-700" },
};
function IndicatorCard({ icon, tone, label, value, sub }: { icon: string; tone: "amber" | "red" | "emerald"; label: string; value: number; sub: string }) {
  const t = CARD_TONES[tone];
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${t.box}`}>
      <div className="flex items-start justify-between">
        <span className={`font-amiri text-3xl font-bold ${t.num}`}>{formatCurrency(value)}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-navy">{label}</p>
      <p className="text-xs text-foreground/50">{sub}</p>
    </div>
  );
}
function SecondaryStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">{formatCurrency(value)}</span>
    </span>
  );
}
function Dot() { return <span className="text-black/15" aria-hidden>·</span>; }

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${active ? "border-gold text-navy" : "border-transparent text-foreground/50 hover:text-navy"}`}>
      {children}
    </button>
  );
}

/* ═══════════ تبويب الفواتير ═══════════ */
function InvoicesTab({ invoices }: { invoices: Invoice[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);

  const filtered = useMemo(
    () => invoices.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (q && !inv.clientName.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }),
    [invoices, q, statusFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم العميل..."
          className="min-w-[200px] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-gold">
          <option value="">كل الحالات</option>
          <option value="due">مستحقة</option>
          <option value="paid">مدفوعة</option>
          <option value="overdue">متأخرة</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">القضية</th>
                <th className="px-4 py-3">الإجمالي (شامل الضريبة)</th>
                <th className="px-4 py-3">الاستحقاق</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">إثبات الحوالة</th>
                <th className="px-4 py-3">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const overdue = inv.status === "overdue";
                return (
                  <tr key={inv.id} className={`border-b border-black/5 last:border-0 ${overdue ? "bg-red-50/50" : "hover:bg-navy/5"}`}>
                    <td className="px-4 py-3 font-medium text-navy">{inv.clientName}</td>
                    <td className="px-4 py-3 text-foreground/70">{inv.caseInternalNumber ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-navy">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">
                      {inv.dueDate ? formatDualDate(inv.dueDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${INVOICE_STATUS_CONFIG[inv.status].className}`}>
                        {INVOICE_STATUS_CONFIG[inv.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {inv.hasProof ? (
                        <a href={`/api/invoices/${inv.id}/proof`} target="_blank" rel="noopener noreferrer" className="text-taradhi hover:underline">
                          📎 عرض الحوالة
                        </a>
                      ) : (
                        <span className="text-foreground/35">— لم تُرفق</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inv.status !== "paid" && (
                        <button type="button" onClick={() => setPayTarget(inv)}
                          className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                          تحديد كمدفوعة
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-foreground/50">لا توجد فواتير</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payTarget && <PayModal invoice={payTarget} onClose={() => setPayTarget(null)} />}
    </div>
  );
}

/* ═══════════ مودال السداد + رفع الحوالة (الإلزامي) ═══════════ */
function PayModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("proof") as HTMLInputElement;
    if (!fileInput.files || fileInput.files.length === 0) {
      toast.error("ارفع إثبات الحوالة أولًا.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("proof", fileInput.files[0]);
      const res = await fetch(`/api/invoices/${invoice.id}/pay`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تسجيل السداد.");
        return;
      }
      toast.success("سُجّل السداد وأُرفقت الحوالة");
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="تسجيل سداد الفاتورة" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-navy/5 px-3 py-2.5 text-sm text-navy">
          <span className="text-foreground/60">العميل:</span> {invoice.clientName}
          <span className="mx-2 text-black/15">·</span>
          <span className="text-foreground/60">الإجمالي:</span>{" "}
          <span className="font-semibold">{formatCurrency(invoice.total)}</span>
        </div>
        <div>
          <label className={labelClass}>إثبات الحوالة <span className="text-red-600">*</span></label>
          <input
            name="proof" type="file" accept="image/*,application/pdf" required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="w-full text-sm"
          />
          <p className="mt-1 text-xs text-foreground/50">
            {fileName ? `الملف: ${fileName}` : "صورة أو PDF لإيصال الحوالة (إلزامي — لا يمكن التحديد كمدفوعة بدونه)."}
          </p>
        </div>
        <ModalActions loading={saving} submitLabel="تأكيد السداد" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

/* ═══════════ تبويب المصاريف ═══════════ */
function ExpensesTab({ expenses }: { expenses: Expense[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-right text-sm">
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
                <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">{formatDualDate(e.expenseDate)}</td>
                <td className="px-4 py-3 text-foreground/70">{e.recordedByName}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-foreground/50">لا توجد مصاريف مسجّلة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════ تبويب أتعاب الخدمات ═══════════ */
function ServicesTab({ services }: { services: Service[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
              <th className="px-4 py-3">الخدمة</th>
              <th className="px-4 py-3">العميل</th>
              <th className="px-4 py-3">الأتعاب</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                <td className="px-4 py-3 font-medium text-navy">{s.title}</td>
                <td className="px-4 py-3 text-foreground/70">{s.clientName}</td>
                <td className="px-4 py-3 font-semibold text-navy">{formatCurrency(s.fee)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${s.isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {s.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-foreground/50">لا خدمات ذات أتعاب مسجّلة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════ مودالات الإنشاء ═══════════ */
function NewInvoiceModal({ clients, cases, onClose }: { clients: OptClient[]; cases: OptCase[]; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("");

  const computedVat = amount ? (Number(amount) * VAT_RATE).toFixed(2) : "";
  const effectiveVat = vat !== "" ? vat : computedVat;
  const total = amount && effectiveVat ? Number(amount) + Number(effectiveVat) : Number(amount || 0);

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
      const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.error(data?.error ?? "تعذّر إنشاء الفاتورة."); return; }
      toast.success("تم إنشاء الفاتورة");
      router.refresh();
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <ModalShell title="فاتورة جديدة" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>العميل</label>
          <select name="clientId" required defaultValue="" className={inputClass}>
            <option value="" disabled>اختر العميل</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>القضية (اختياري)</label>
          <select name="caseId" defaultValue="" className={inputClass}>
            <option value="">بدون قضية</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.internalNumber} — {c.title}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>المبلغ (ر.س)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} dir="ltr" />
          </div>
          <div>
            <label className={labelClass}>ضريبة القيمة المضافة</label>
            <input type="number" step="0.01" min="0" value={effectiveVat} onChange={(e) => setVat(e.target.value)} placeholder="15% تلقائيًا" className={inputClass} dir="ltr" />
          </div>
        </div>
        <div>
          <label className={labelClass}>تاريخ الاستحقاق</label>
          <input name="dueDate" type="date" className={inputClass} dir="ltr" />
        </div>
        <p className="rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy">الإجمالي: <span className="font-semibold">{formatCurrency(total)}</span></p>
        <ModalActions loading={loading} submitLabel="إنشاء الفاتورة" onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function NewExpenseModal({ cases, onClose }: { cases: OptCase[]; onClose: () => void }) {
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
      const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.error(data?.error ?? "تعذّر تسجيل المصروف."); return; }
      toast.success("تم تسجيل المصروف");
      router.refresh();
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <ModalShell title="مصروف جديد" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>القضية</label>
          <select name="caseId" required defaultValue="" className={inputClass}>
            <option value="" disabled>اختر القضية</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.internalNumber} — {c.title}</option>)}
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

/* ═══════════ أغلفة المودال ═══════════ */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground" aria-label="إغلاق">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ loading, submitLabel, onClose }: { loading: boolean; submitLabel: string; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
      <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
      <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
        {loading ? "جارٍ الحفظ..." : submitLabel}
      </button>
    </div>
  );
}
