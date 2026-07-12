import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewRejectedBank, REJECTION_REASON_LABELS_AR } from "@/lib/intake";
import { formatDualDate } from "@/lib/dateUtils";

export default async function RejectedIntakePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (!canViewRejectedBank(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        بنك الرفضات متاح لمسؤول النظام والمشرف فقط.
      </div>
    );
  }

  const rejected = await prisma.intakeRequest.findMany({
    where: { status: "rejected" },
    orderBy: { decisionAt: "desc" },
    include: { decisionBy: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">بنك الرفضات</h1>
          <p className="text-sm text-foreground/60">
            الطلبات المرفوضة — للمراجعة قبل قبول قضايا مشابهة
          </p>
        </div>
        <Link href="/intake" className="text-sm text-gold hover:underline">
          العودة لطلبات الاستلام
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">الطرف المقابل</th>
                <th className="px-4 py-3">سبب الرفض</th>
                <th className="px-4 py-3">الملاحظات</th>
                <th className="px-4 py-3">رفضه</th>
                <th className="px-4 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {rejected.map((it) => (
                <tr key={it.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                  <td className="px-4 py-3">
                    <Link href={`/intake/${it.id}`} className="font-medium text-taradhi hover:underline">
                      {it.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{it.opposingParty ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                      {it.rejectionReason ? REJECTION_REASON_LABELS_AR[it.rejectionReason] : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[220px] truncate text-foreground/70">
                    {it.rejectionNotes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{it.decisionBy?.fullName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">
                    {it.decisionAt ? formatDualDate(it.decisionAt) : "—"}
                  </td>
                </tr>
              ))}
              {rejected.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-foreground/50">
                    لا توجد طلبات مرفوضة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
