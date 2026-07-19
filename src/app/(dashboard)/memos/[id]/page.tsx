import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import {
  MEMO_STATUS_LABELS_AR,
  MEMO_STATUS_STYLES,
  canEditMemo,
  canReviewMemo,
} from "@/lib/memos";
import { formatDualDateTime } from "@/lib/dateUtils";
import { MemoForm } from "../MemoForm";
import { MemoActions } from "./MemoActions";
import { SupplementButton } from "./SupplementButton";

export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const memo = await prisma.legalMemo.findUnique({
    where: { id },
    include: {
      case: { include: { team: true, accessOverrides: true } },
      authoredBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
      reviews: { include: { reviewedBy: { select: { fullName: true } } }, orderBy: { reviewedAt: "desc" } },
    },
  });

  if (!memo) notFound();
  if (!canAccessCase(session.user, memo.case)) notFound();

  const editable = canEditMemo(session.user, memo);
  const reviewer = canReviewMemo(session.user.role);
  const canSupplement =
    (memo.status === "approved" || memo.status === "submitted_to_court") &&
    session.user.role !== "accountant" &&
    session.user.role !== "secretary";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">{memo.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${MEMO_STATUS_STYLES[memo.status]}`}>
              {MEMO_STATUS_LABELS_AR[memo.status]}
            </span>
            <span className="text-foreground/50">{memo.memoType}</span>
            <span className="text-foreground/40">·</span>
            <Link href={`/cases/${memo.case.id}`} className="text-taradhi hover:underline">
              {memo.case.internalNumber}
            </Link>
          </div>
          <p className="mt-1 text-xs text-foreground/50">
            الباحث: {memo.authoredBy.fullName}
            {memo.approvedBy ? ` · اعتمدها: ${memo.approvedBy.fullName}` : ""}
          </p>
        </div>
        <Link href="/memos" className="text-sm text-gold hover:underline">
          العودة للمذكرات
        </Link>
      </div>

      {/* لوحة إجراءات المحامي (مراجعة/تقديم) */}
      <MemoActions memoId={memo.id} status={memo.status} canReview={reviewer} />

      {/* نسخة معدّلة للمذكرات المعتمدة/المُقدّمة */}
      {canSupplement && <SupplementButton memoId={memo.id} />}

      {editable ? (
        <MemoForm
          mode="edit"
          fixedCaseId={memo.caseId}
          memo={{
            id: memo.id,
            title: memo.title,
            memoType: memo.memoType,
            content: memo.content,
            legalBasis: memo.legalBasis,
            precedents: memo.precedents,
            circulars: memo.circulars,
          }}
        />
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-navy">نص المذكرة</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {memo.content || "—"}
            </p>
          </section>

          <section className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold text-navy">البحث القانوني المرفق</h2>
            <dl className="space-y-3 text-sm">
              <ResearchField label="الأنظمة واللوائح المستند إليها" value={memo.legalBasis} />
              <ResearchField label="السوابق القضائية" value={memo.precedents} />
              <ResearchField label="التعاميم ذات الصلة" value={memo.circulars} />
            </dl>
          </section>
        </div>
      )}

      {memo.reviews.length > 0 && (
        <section className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">سجل المراجعات</h2>
          <ul className="space-y-3">
            {memo.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-black/5 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-navy">{r.reviewedBy.fullName}</span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.action === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {r.action === "approved" ? "اعتماد" : "طلب تعديلات"}
                  </span>
                </div>
                {r.comments && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/70">{r.comments}</p>
                )}
                <p className="mt-1 text-xs text-foreground/40" dir="ltr">
                  {formatDualDateTime(r.reviewedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ResearchField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-foreground/80">{value || "—"}</dd>
    </div>
  );
}
