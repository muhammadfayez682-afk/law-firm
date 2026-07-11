import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canEditCase, isSystemAdmin } from "@/lib/rbac";
import { getAmicableSettlementPlatform, getCaseFlowStages, getFirstStage } from "@/lib/caseFlow";
import { canAuthorMemo, canReviewMemo } from "@/lib/memos";
import { CaseDetailView } from "./CaseDetailView";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      client: true,
      responsibleLawyer: true,
      parties: { include: { linkedClient: true } },
      team: { include: { user: true } },
      accessOverrides: true,
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      sessions: { orderBy: { sessionDate: "asc" } },
      amicableSettlement: true,
      closureRequest: { include: { requestedBy: true, approvedBy: true } },
      reopenLogs: { include: { reopenedBy: true }, orderBy: { reopenedAt: "desc" } },
      memos: {
        orderBy: { updatedAt: "desc" },
        include: { authoredBy: { select: { fullName: true } } },
      },
    },
  });

  if (!caseData) notFound();
  if (!canAccessCase(session.user, caseData)) notFound();

  const [flowStages, firstStage] = await Promise.all([
    getCaseFlowStages(caseData.caseType),
    getFirstStage(caseData.caseType),
  ]);
  const settlementPlatform = getAmicableSettlementPlatform(caseData.caseType);

  const serializedCase = {
    ...caseData,
    claimValue: caseData.claimValue ? Number(caseData.claimValue) : null,
  };

  const memos = caseData.memos.map((m) => ({
    id: m.id,
    title: m.title,
    memoType: m.memoType,
    status: m.status,
    authorName: m.authoredBy.fullName,
    updatedAt: m.updatedAt.toISOString(),
  }));
  const pendingMemoReview = canReviewMemo(session.user.role)
    ? caseData.memos.filter((m) => m.status === "submitted").length
    : 0;

  return (
    <CaseDetailView
      caseData={serializedCase}
      canEdit={canEditCase(session.user, caseData)}
      flowStages={flowStages}
      firstStage={firstStage}
      settlementPlatform={settlementPlatform}
      currentUserId={session.user.id}
      isSystemAdmin={isSystemAdmin(session.user.role)}
      memos={memos}
      canAddMemo={canAuthorMemo(session.user.role)}
      pendingMemoReview={pendingMemoReview}
    />
  );
}
