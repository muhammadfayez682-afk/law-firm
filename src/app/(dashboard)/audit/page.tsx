import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAuditLog, ROLE_LABELS_AR } from "@/lib/rbac";
import {
  AUDIT_ACTION_LABELS_AR,
  AUDIT_ACTION_STYLES,
  AUDIT_PAGE_SIZE,
  buildAuditWhere,
  resourceLink,
  resourceTypeLabel,
} from "@/lib/audit";
import { formatDualDateTime } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";
import { AuditToolbar } from "./AuditToolbar";

type SearchParams = {
  q?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (!canViewAuditLog(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        سجل التدقيق متاح للشركاء فقط.
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const where = buildAuditWhere(params);

  const [logs, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { user: { select: { fullName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">سجل التدقيق</h1>
        <p className="text-sm text-foreground/60">{toEnglishDigits(total)} سجل</p>
      </div>

      <AuditToolbar users={users} />

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">التاريخ والوقت</th>
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">الإجراء</th>
                <th className="px-4 py-3">المورد</th>
                <th className="px-4 py-3">عنوان IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const link = resourceLink(log.resourceType, log.resourceId);
                return (
                  <tr key={log.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                    <td className="px-4 py-3 text-foreground/70" dir="ltr">
                      {formatDualDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{log.user.fullName}</p>
                      <p className="text-xs text-foreground/40">{ROLE_LABELS_AR[log.user.role]}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${AUDIT_ACTION_STYLES[log.action]}`}
                      >
                        {AUDIT_ACTION_LABELS_AR[log.action]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {link ? (
                        <Link href={link} className="text-taradhi hover:underline">
                          {resourceTypeLabel(log.resourceType)}
                        </Link>
                      ) : (
                        <span className="text-foreground/70">
                          {resourceTypeLabel(log.resourceType)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/50" dir="ltr">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                );
              })}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-foreground/50">
                    لا توجد سجلات مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AuditPagination page={page} totalPages={totalPages} params={params} />
    </div>
  );
}

function AuditPagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: SearchParams;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value && key !== "page") search.set(key, value);
        }
        if (p > 1) search.set("page", String(p));
        const qs = search.toString();
        return (
          <Link
            key={p}
            href={qs ? `/audit?${qs}` : "/audit"}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              p === page ? "bg-navy text-white" : "border border-black/10 text-navy hover:bg-black/5"
            }`}
          >
            {p}
          </Link>
        );
      })}
    </nav>
  );
}
