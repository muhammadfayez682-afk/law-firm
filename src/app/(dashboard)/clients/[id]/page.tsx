import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import type { CaseStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/rbac";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { formatDualDate } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";
import { EntityChangeLog } from "@/components/shared/EntityChangeLog";
import { ClientEditButton } from "./ClientEditButton";

const CLOSED_STATUSES: CaseStatus[] = ["closed", "archived"];
const EXPIRY_WARNING_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CLIENT_TYPE_LABELS_AR: Record<string, string> = {
  individual: "فرد",
  company: "شركة",
};

const AGENCY_TYPE_LABELS_AR: Record<string, string> = {
  general: "عامة",
  special: "خاصة",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      agencies: { orderBy: { expiryDate: "asc" } },
      cases: {
        orderBy: { createdAt: "desc" },
        include: { responsibleLawyer: true, team: true, accessOverrides: true },
      },
    },
  });

  if (!client) notFound();
  if (!canAccessClient(session.user, client)) notFound();

  // المحاسب يرى بيانات العميل لأغراض الفوترة لكن دون تفاصيل قضاياه.
  const canSeeCases = session.user.role !== "accountant";
  const isActive = client.cases.some((c) => !CLOSED_STATUSES.includes(c.status));
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-foreground/50">
            {CLIENT_TYPE_LABELS_AR[client.type]}
          </p>
          <h1 className="font-amiri text-2xl font-bold text-navy">{client.fullName}</h1>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {isActive ? "نشط" : "غير نشط"}
          </span>
        </div>
        {session.user.role !== "accountant" && (
          <ClientEditButton
            client={{
              id: client.id,
              type: client.type,
              fullName: client.fullName,
              nationalIdOrCr: client.nationalIdOrCr,
              phone: client.phone,
              email: client.email,
              representativeName: client.representativeName,
            }}
            userRole={session.user.role}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canSeeCases && (
            <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-navy">قضايا العميل</h2>
              {client.cases.length === 0 ? (
                <p className="text-sm text-foreground/50">لا توجد قضايا مسجّلة لهذا العميل</p>
              ) : (
                <ul className="divide-y divide-black/5">
                  {client.cases.map((c) => (
                    <li key={c.id} className="py-2.5">
                      <Link
                        href={`/cases/${c.id}`}
                        className="flex items-center justify-between text-sm hover:text-taradhi"
                      >
                        <div>
                          <p className="font-medium text-navy">{c.title}</p>
                          <p className="text-xs text-foreground/50">
                            {c.internalNumber} · {c.responsibleLawyer.fullName}
                          </p>
                        </div>
                        <CaseStatusBadge status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-navy">الوكالات المرتبطة</h2>
            {client.agencies.length === 0 ? (
              <p className="text-sm text-foreground/50">لا توجد وكالات مسجّلة</p>
            ) : (
              <ul className="space-y-2">
                {client.agencies.map((agency) => {
                  const daysLeft = Math.ceil(
                    (new Date(agency.expiryDate).getTime() - now.getTime()) / MS_PER_DAY
                  );
                  const isExpiring = daysLeft <= EXPIRY_WARNING_DAYS;

                  return (
                    <li
                      key={agency.id}
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        isExpiring ? "border-red-200 bg-red-50" : "border-black/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-navy" dir="ltr">
                          {toEnglishDigits(agency.agencyNumber)}
                        </span>
                        <span className="text-xs text-foreground/50">
                          {AGENCY_TYPE_LABELS_AR[agency.agencyType]}
                        </span>
                      </div>
                      <p className="mt-1 text-foreground/70">{agency.scopeText}</p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-foreground/50">
                          ينتهي في {formatDualDate(agency.expiryDate)}
                        </span>
                        {isExpiring && (
                          <span className="font-semibold text-red-600">
                            {daysLeft > 0 ? `تنتهي خلال ${daysLeft} يومًا` : "منتهية الصلاحية"}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-navy">بيانات العميل</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-foreground/50">
                  {client.type === "individual" ? "رقم الهوية" : "رقم السجل التجاري"}
                </dt>
                <dd className="mt-0.5 font-medium text-navy" dir="ltr">
                  {client.nationalIdOrCr ? toEnglishDigits(client.nationalIdOrCr) : "—"}
                </dd>
              </div>
              {client.type === "individual" ? (
                <div>
                  <dt className="text-xs text-foreground/50">الجنسية</dt>
                  <dd className="mt-0.5 font-medium text-navy">{client.nationality ?? "—"}</dd>
                </div>
              ) : (
                <div>
                  <dt className="text-xs text-foreground/50">اسم الممثل</dt>
                  <dd className="mt-0.5 font-medium text-navy">
                    {client.representativeName ?? "—"}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-foreground/50">الجوال</dt>
                <dd className="mt-0.5 font-medium text-navy" dir="ltr">
                  {client.phone ? toEnglishDigits(client.phone) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-foreground/50">البريد الإلكتروني</dt>
                <dd className="mt-0.5 font-medium text-navy" dir="ltr">
                  {client.email ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-foreground/50">تاريخ التسجيل</dt>
                <dd className="mt-0.5 font-medium text-navy">
                  {formatDualDate(client.createdAt)}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      {session.user.role !== "accountant" && (
        <EntityChangeLog entityType="client" entityId={client.id} />
      )}
    </div>
  );
}
