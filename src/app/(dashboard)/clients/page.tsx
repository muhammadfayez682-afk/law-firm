import Link from "next/link";
import { getServerSession } from "next-auth/next";
import type { CaseStatus, ClientType, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientVisibilityWhere } from "@/lib/rbac";
import { ClientsToolbar } from "./ClientsToolbar";

const CLOSED_STATUSES: CaseStatus[] = ["closed", "archived"];

const CLIENT_TYPE_LABELS_AR: Record<string, string> = {
  individual: "فرد",
  company: "شركة",
};

type SearchParams = { q?: string; type?: string; status?: string };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;

  const where: Prisma.ClientWhereInput = {
    ...clientVisibilityWhere(session.user),
    ...(params.type ? { type: params.type as ClientType } : {}),
    ...(params.q
      ? {
          OR: [
            { fullName: { contains: params.q, mode: "insensitive" } },
            { nationalIdOrCr: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      cases: { select: { status: true } },
      _count: { select: { cases: true } },
    },
  });

  const withComputedStatus = clients.map((c) => {
    const isActive = c.cases.some((cs) => !CLOSED_STATUSES.includes(cs.status));
    return { ...c, isActive };
  });

  const filtered =
    params.status === "active"
      ? withComputedStatus.filter((c) => c.isActive)
      : params.status === "inactive"
        ? withComputedStatus.filter((c) => !c.isActive)
        : withComputedStatus;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-amiri text-2xl font-bold text-navy">العملاء</h1>
        <p className="text-sm text-foreground/60">{filtered.length} عميل</p>
      </div>

      <ClientsToolbar canCreate={session.user.role !== "accountant"} />

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="hidden grid-cols-5 gap-4 border-b border-black/5 bg-navy/5 px-5 py-3 text-xs font-medium text-foreground/50 sm:grid">
          <span>الاسم</span>
          <span>النوع</span>
          <span>الهوية / السجل</span>
          <span>عدد القضايا</span>
          <span>الحالة</span>
        </div>

        <div className="divide-y divide-black/5">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="grid grid-cols-1 gap-1 px-5 py-3 text-sm transition-colors hover:bg-navy/5 sm:grid-cols-5 sm:items-center sm:gap-4"
            >
              <span className="truncate font-medium text-navy">{c.fullName}</span>
              <span className="text-foreground/70">{CLIENT_TYPE_LABELS_AR[c.type]}</span>
              <span className="text-foreground/70" dir="ltr">
                {c.nationalIdOrCr ?? "—"}
              </span>
              <span className="text-foreground/70">{c._count.cases}</span>
              <span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {c.isActive ? "نشط" : "غير نشط"}
                </span>
              </span>
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-foreground/50">
              لا يوجد عملاء مطابقون لبحثك
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
