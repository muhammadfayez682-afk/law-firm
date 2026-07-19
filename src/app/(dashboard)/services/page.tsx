import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CASE_HANDLER_ROLES } from "@/lib/rbac";
import {
  SERVICE_STATUS_LABELS_AR,
  SERVICE_STATUS_STYLES,
  SERVICE_TYPE_LABELS_AR,
  canCreateService,
  serviceVisibilityWhere,
} from "@/lib/services";
import { ServicesToolbar } from "./ServicesToolbar";

type SearchParams = { q?: string; status?: string; serviceType?: string; assignedToId?: string };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;
  const where = {
    ...serviceVisibilityWhere(session.user),
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.serviceType ? { serviceType: params.serviceType as never } : {}),
    ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            { serviceNumber: { contains: params.q, mode: "insensitive" as const } },
            { client: { fullName: { contains: params.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [services, clients, users] = await Promise.all([
    prisma.legalService.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { fullName: true } }, assignedTo: { select: { fullName: true } } },
    }),
    prisma.client.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.user.findMany({ where: { isActive: true, role: { in: CASE_HANDLER_ROLES } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">الخدمات القانونية</h1>
          <p className="text-sm text-foreground/60">{services.length} خدمة</p>
        </div>
      </div>

      <ServicesToolbar clients={clients} users={users} canCreate={canCreateService(session.user.role)} />

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="hidden grid-cols-6 gap-4 border-b border-black/5 bg-navy/5 px-5 py-3 text-xs font-medium text-foreground/50 sm:grid">
          <span>الرقم</span>
          <span>العنوان</span>
          <span>النوع</span>
          <span>العميل</span>
          <span>المسؤول</span>
          <span>الحالة</span>
        </div>
        <div className="divide-y divide-black/5">
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/services/${s.id}`}
              className="grid grid-cols-1 gap-1 px-5 py-3 text-sm transition-colors hover:bg-navy/5 sm:grid-cols-6 sm:items-center sm:gap-4"
            >
              <span className="font-mono text-xs text-navy" dir="ltr">{s.serviceNumber}</span>
              <span className="truncate font-medium text-navy">{s.title}</span>
              <span className="text-foreground/70">{SERVICE_TYPE_LABELS_AR[s.serviceType]}</span>
              <span className="truncate text-foreground/70">{s.client.fullName}</span>
              <span className="truncate text-foreground/70">{s.assignedTo.fullName}</span>
              <span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${SERVICE_STATUS_STYLES[s.status]}`}>
                  {SERVICE_STATUS_LABELS_AR[s.status]}
                </span>
              </span>
            </Link>
          ))}
          {services.length === 0 && (
            <div className="px-5 py-10 text-center text-foreground/50">لا توجد خدمات مطابقة</div>
          )}
        </div>
      </div>
    </div>
  );
}
