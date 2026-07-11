import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateCase } from "@/lib/rbac";
import { buildCasesWhere, CASES_PAGE_SIZE } from "@/lib/case-filters";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { CasesToolbar } from "./CasesToolbar";
import { CasesPagination } from "./CasesPagination";
import { formatDualDate } from "@/lib/dateUtils";

const CASE_TYPE_LABELS_AR: Record<string, string> = {
  general: "عام",
  commercial: "تجارية",
  labor: "عمالية",
  personal_status: "أحوال شخصية",
  criminal: "جزائية",
  administrative: "إداري",
  committee: "لجان",
  arbitration: "تحكيم",
  debt_collection: "تحصيل ديون",
  other: "أخرى",
};

type SearchParams = {
  q?: string;
  status?: string;
  caseType?: string;
  lawyerId?: string;
  page?: string;
};

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = buildCasesWhere(session.user, {
    q: params.q,
    status: params.status,
    caseType: params.caseType,
    lawyerId: params.lawyerId,
  });

  const [cases, total, clients, lawyers] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * CASES_PAGE_SIZE,
      take: CASES_PAGE_SIZE,
      include: { client: true, responsibleLawyer: true },
    }),
    prisma.case.count({ where }),
    prisma.client.findMany({ orderBy: { fullName: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["partner", "senior_lawyer", "lawyer"] } },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / CASES_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">القضايا</h1>
          <p className="text-sm text-foreground/60">{total} قضية</p>
        </div>
      </div>

      <CasesToolbar
        clients={clients}
        lawyers={lawyers}
        canCreate={canCreateCase(session.user.role)}
      />

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="hidden grid-cols-6 gap-4 border-b border-black/5 bg-navy/5 px-5 py-3 text-xs font-medium text-foreground/50 sm:grid">
          <span>عنوان القضية</span>
          <span>العميل</span>
          <span>النوع</span>
          <span>المحامي</span>
          <span>الحالة</span>
          <span>آخر تحديث</span>
        </div>

        <div className="divide-y divide-black/5">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="grid grid-cols-1 gap-1 px-5 py-3 text-sm transition-colors hover:bg-navy/5 sm:grid-cols-6 sm:items-center sm:gap-4"
            >
              <span className="truncate font-medium text-navy">{c.title}</span>
              <span className="truncate text-foreground/70">{c.client.fullName}</span>
              <span className="text-foreground/70">
                {CASE_TYPE_LABELS_AR[c.caseType] ?? c.caseType}
              </span>
              <span className="truncate text-foreground/70">{c.responsibleLawyer.fullName}</span>
              <span>
                <CaseStatusBadge status={c.status} />
              </span>
              <span className="text-xs text-foreground/50">
                {formatDualDate(c.updatedAt)}
              </span>
            </Link>
          ))}

          {cases.length === 0 && (
            <div className="px-5 py-10 text-center text-foreground/50">
              لا توجد قضايا مطابقة لبحثك
            </div>
          )}
        </div>
      </div>

      <CasesPagination
        page={page}
        totalPages={totalPages}
        params={{
          q: params.q,
          status: params.status,
          caseType: params.caseType,
          lawyerId: params.lawyerId,
        }}
      />
    </div>
  );
}
