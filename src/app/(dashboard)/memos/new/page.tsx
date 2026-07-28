import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere, canPerformOnCase, casePermissionInclude } from "@/lib/rbac";
import { canAuthorMemo } from "@/lib/memos";
import { MemoForm } from "../MemoForm";

export default async function NewMemoPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; sessionId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { caseId: rawCaseId, sessionId } = await searchParams;

  // القضية المعنية: من caseId مباشرة، أو من جلسة (sessionId) في سياق مذكرة الجلسة.
  let contextCaseId = rawCaseId ?? null;
  if (!contextCaseId && sessionId) {
    const s = await prisma.session.findUnique({ where: { id: sessionId }, select: { caseId: true } });
    contextCaseId = s?.caseId ?? null;
  }

  // ===== البوّابة =====
  // مع سياق قضية: يُسمح لمن يملك write_memo عليها (باحث/مسؤول/محامٍ رئيسي/مُفوَّض).
  // بلا سياق قضية: يبقى القيد على الباحث/المسؤول (مذكرة عامة).
  let allowed = false;
  let contextCase: { id: string; title: string; internalNumber: string } | null = null;
  if (contextCaseId) {
    const caseData = await prisma.case.findUnique({
      where: { id: contextCaseId },
      include: casePermissionInclude,
    });
    if (caseData && canPerformOnCase(session.user, caseData, "write_memo")) {
      allowed = true;
      contextCase = { id: caseData.id, title: caseData.title, internalNumber: caseData.internalNumber };
    }
  } else {
    allowed = canAuthorMemo(session.user.role);
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
        لا تملك صلاحية كتابة مذكرة{contextCaseId ? " لهذه القضية" : ""}.
      </div>
    );
  }

  // قائمة القضايا للاختيار (عند غياب سياق قضية)؛ ومع السياق نثبّت القضية المعنية.
  const cases = contextCase
    ? [contextCase]
    : await prisma.case.findMany({
        where: caseVisibilityWhere(session.user),
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, internalNumber: true },
      });
  const defaultCaseId = contextCase?.id ?? undefined;

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

      <MemoForm mode="new" cases={cases} fixedCaseId={defaultCaseId} sessionId={sessionId} />
    </div>
  );
}
