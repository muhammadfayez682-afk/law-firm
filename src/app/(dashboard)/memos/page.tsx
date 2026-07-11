import Link from "next/link";
import { getServerSession } from "next-auth/next";
import type { MemoStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere, type SessionUser } from "@/lib/rbac";
import {
  MEMO_STATUS_LABELS_AR,
  MEMO_STATUS_STYLES,
  canAuthorMemo,
  canReviewMemo,
  memoVisibilityWhere,
} from "@/lib/memos";
import { formatDualDate } from "@/lib/dateUtils";
import { toEnglishDigits } from "@/lib/formatNumber";
import { MemosToolbar } from "./MemosToolbar";

type SearchParams = { q?: string; status?: string; caseId?: string; authorId?: string };

export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const params = await searchParams;

  const where: Prisma.LegalMemoWhereInput = {
    ...memoVisibilityWhere(session.user),
    ...(params.status ? { status: params.status as MemoStatus } : {}),
    ...(params.caseId ? { caseId: params.caseId } : {}),
    ...(params.authorId ? { authoredById: params.authorId } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { case: { title: { contains: params.q, mode: "insensitive" } } },
            { case: { internalNumber: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [memos, casesForFilter, researchers] = await Promise.all([
    prisma.legalMemo.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        case: { select: { id: true, title: true, internalNumber: true } },
        authoredBy: { select: { fullName: true } },
      },
    }),
    prisma.case.findMany({
      where: caseVisibilityWhere(session.user),
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, internalNumber: true },
    }),
    prisma.user.findMany({
      where: { role: "researcher" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  const summary = await buildSummary(session.user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">المذكرات</h1>
          <p className="text-sm text-foreground/60">{toEnglishDigits(memos.length)} مذكرة</p>
        </div>
        {canAuthorMemo(session.user.role) && (
          <Link
            href="/memos/new"
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            + مذكرة جديدة
          </Link>
        )}
      </div>

      {summary.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {summary.map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border border-black/5 border-r-4 ${card.accent} bg-white p-5 shadow-sm`}
            >
              <p className="text-sm text-foreground/50">{card.label}</p>
              <p className="mt-2 font-amiri text-2xl font-bold text-navy">
                {toEnglishDigits(card.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      <MemosToolbar cases={casesForFilter} researchers={researchers} />

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-right text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-navy/5 text-xs font-medium text-foreground/50">
                <th className="px-4 py-3">عنوان المذكرة</th>
                <th className="px-4 py-3">القضية</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">الباحث</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">آخر تحديث</th>
              </tr>
            </thead>
            <tbody>
              {memos.map((memo) => (
                <tr key={memo.id} className="border-b border-black/5 last:border-0 hover:bg-navy/5">
                  <td className="px-4 py-3">
                    <Link href={`/memos/${memo.id}`} className="font-medium text-taradhi hover:underline">
                      {memo.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/cases/${memo.case.id}`} className="text-navy hover:underline">
                      {memo.case.internalNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{memo.memoType}</td>
                  <td className="px-4 py-3 text-foreground/70">{memo.authoredBy.fullName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${MEMO_STATUS_STYLES[memo.status]}`}
                    >
                      {MEMO_STATUS_LABELS_AR[memo.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/50" dir="ltr">
                    {formatDualDate(memo.updatedAt)}
                  </td>
                </tr>
              ))}
              {memos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-foreground/50">
                    لا توجد مذكرات مطابقة
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

async function buildSummary(user: SessionUser) {
  const cards: { label: string; value: number; accent: string }[] = [];

  if (canAuthorMemo(user.role)) {
    const [mine, changes, approved] = await Promise.all([
      prisma.legalMemo.count({ where: { authoredById: user.id, status: "draft" } }),
      prisma.legalMemo.count({ where: { authoredById: user.id, status: "changes_requested" } }),
      prisma.legalMemo.count({
        where: { authoredById: user.id, status: { in: ["approved", "submitted_to_court"] } },
      }),
    ]);
    cards.push({ label: "مذكراتي قيد الكتابة", value: mine, accent: "border-r-navy" });
    cards.push({ label: "تعديلات مطلوبة", value: changes, accent: "border-r-orange-500" });
    cards.push({ label: "مذكرات معتمدة", value: approved, accent: "border-r-emerald-500" });
  } else if (canReviewMemo(user.role)) {
    const [awaiting, approved] = await Promise.all([
      prisma.legalMemo.count({
        where: { status: "submitted", case: caseVisibilityWhere(user) },
      }),
      prisma.legalMemo.count({
        where: { status: { in: ["approved", "submitted_to_court"] }, case: caseVisibilityWhere(user) },
      }),
    ]);
    cards.push({ label: "بانتظار مراجعتي", value: awaiting, accent: "border-r-blue-500" });
    cards.push({ label: "معتمدة", value: approved, accent: "border-r-emerald-500" });
  }

  return cards;
}
