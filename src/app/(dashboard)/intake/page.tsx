import Link from "next/link";
import { getServerSession } from "next-auth/next";
import type { IntakeSource, IntakeStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CONFLICT_RESULT_STYLES,
  INTAKE_SOURCE_LABELS_AR,
  INTAKE_STATUS_LABELS_AR,
  INTAKE_STATUS_STYLES,
  intakeVisibilityWhere,
} from "@/lib/intake";
import { formatDualDate } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";
import { IntakeToolbar } from "./IntakeToolbar";

const CASE_TYPE_LABELS_AR: Record<string, string> = {
  general: "عام", commercial: "تجارية", labor: "عمالية", personal_status: "أحوال شخصية",
  criminal: "جزائية", administrative: "إداري", committee: "لجان", arbitration: "تحكيم",
  debt_collection: "تحصيل ديون", other: "أخرى",
};

type SearchParams = { q?: string; status?: string; source?: string; receivedById?: string };

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;
  const visWhere = intakeVisibilityWhere(session.user);

  const where: Prisma.IntakeRequestWhereInput = {
    ...visWhere,
    ...(params.status ? { status: params.status as IntakeStatus } : {}),
    ...(params.source ? { source: params.source as IntakeSource } : {}),
    ...(params.receivedById ? { receivedById: params.receivedById } : {}),
    ...(params.q
      ? {
          OR: [
            { requestNumber: { contains: params.q, mode: "insensitive" } },
            { clientName: { contains: params.q, mode: "insensitive" } },
            { opposingParty: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [intakes, receivers, newToday, underAssessment, awaitingFee, confirmedConflicts] =
    await Promise.all([
      prisma.intakeRequest.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        include: { receivedBy: { select: { fullName: true } } },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      }),
      prisma.intakeRequest.count({ where: { ...visWhere, receivedAt: { gte: startOfToday } } }),
      prisma.intakeRequest.count({ where: { ...visWhere, status: "under_assessment" } }),
      prisma.intakeRequest.count({ where: { ...visWhere, status: "fee_agreement_pending" } }),
      prisma.intakeRequest.count({
        where: { ...visWhere, conflictResult: "confirmed", status: { notIn: ["accepted", "rejected"] } },
      }),
    ]);

  const cards = [
    { label: "طلبات جديدة اليوم", value: newToday, accent: "border-r-navy" },
    { label: "قيد التقييم", value: underAssessment, accent: "border-r-purple-500" },
    { label: "بانتظار عقد الأتعاب", value: awaitingFee, accent: "border-r-orange-500" },
    { label: "⚠️ تعارض مصالح مؤكد", value: confirmedConflicts, accent: "border-r-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">طلبات الاستلام</h1>
        <p className="text-sm text-foreground/60">{toEnglishDigits(intakes.length)} طلب</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border border-black/5 border-r-4 ${c.accent} bg-white p-5 shadow-sm`}>
            <p className="text-sm text-foreground/50">{c.label}</p>
            <p className="mt-2 font-amiri text-2xl font-bold text-navy">{toEnglishDigits(c.value)}</p>
          </div>
        ))}
      </div>

      <IntakeToolbar receivers={receivers} />

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">رقم الطلب</th>
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">ملخص النزاع</th>
                <th className="px-4 py-3">النوع المقترح</th>
                <th className="px-4 py-3">المصدر</th>
                <th className="px-4 py-3">المستلم</th>
                <th className="px-4 py-3">التعارض</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {intakes.map((it) => (
                <tr key={it.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                  <td className="px-4 py-3">
                    <Link href={`/intake/${it.id}`} className="font-mono text-xs font-medium text-taradhi hover:underline" dir="ltr">
                      {it.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{it.clientName}</p>
                    <p className="text-xs text-foreground/40" dir="ltr">{toEnglishDigits(it.clientPhone)}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-foreground/70">{it.disputeSummary}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {it.proposedType ? CASE_TYPE_LABELS_AR[it.proposedType] ?? it.proposedType : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{INTAKE_SOURCE_LABELS_AR[it.source]}</td>
                  <td className="px-4 py-3">
                    <p className="text-foreground/70">{it.receivedBy.fullName}</p>
                    <p className="text-xs text-foreground/40" dir="ltr">{formatDualDate(it.receivedAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFLICT_RESULT_STYLES[it.conflictResult]}`}>
                      {it.conflictResult === "confirmed" ? "مؤكد" : it.conflictResult === "potential" ? "محتمل" : it.conflictResult === "clear" ? "نظيف" : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${INTAKE_STATUS_STYLES[it.status]}`}>
                      {INTAKE_STATUS_LABELS_AR[it.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {intakes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-foreground/50">لا توجد طلبات مطابقة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
