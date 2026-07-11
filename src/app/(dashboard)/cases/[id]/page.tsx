import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canEditCase } from "@/lib/rbac";
import { getAmicableSettlementPlatform, getCaseFlowStages, getFirstStage } from "@/lib/caseFlow";
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

  return (
    <CaseDetailView
      caseData={serializedCase}
      canEdit={canEditCase(session.user, caseData)}
      flowStages={flowStages}
      firstStage={firstStage}
      settlementPlatform={settlementPlatform}
    />
  );
}
