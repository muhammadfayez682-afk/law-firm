import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere } from "@/lib/rbac";
import { canAuthorMemo } from "@/lib/memos";
import { MemoForm } from "../MemoForm";

export default async function NewMemoPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  if (!canAuthorMemo(session.user.role)) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        كتابة المذكرات متاحة للباحث القانوني فقط.
      </div>
    );
  }

  const { caseId } = await searchParams;

  const cases = await prisma.case.findMany({
    where: caseVisibilityWhere(session.user),
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, internalNumber: true },
  });

  // تحقّق أن القضية المُمرَّرة ضمن القضايا المرئية قبل تمريرها كقيمة افتراضية.
  const defaultCaseId = caseId && cases.some((c) => c.id === caseId) ? caseId : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">مذكرة جديدة</h1>
          <p className="text-sm text-foreground/60">اكتب المذكرة والبحث القانوني المرفق</p>
        </div>
        <Link href="/memos" className="text-sm text-gold hover:underline">
          العودة للمذكرات
        </Link>
      </div>

      <MemoForm mode="new" cases={cases} fixedCaseId={defaultCaseId} />
    </div>
  );
}
