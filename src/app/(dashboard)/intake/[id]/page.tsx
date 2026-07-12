import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CASE_HANDLER_ROLES } from "@/lib/rbac";
import { canAccessIntake, canActivateIntake, canAssessIntake } from "@/lib/intake";
import { IntakeDetailView } from "./IntakeDetailView";

export default async function IntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({
    where: { id },
    include: {
      receivedBy: { select: { fullName: true } },
      assessmentBy: { select: { fullName: true } },
      decisionBy: { select: { fullName: true } },
      case: { select: { id: true, internalNumber: true } },
      documents: { include: { uploadedBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      notes: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!intake) notFound();
  if (!canAccessIntake(session.user, intake)) notFound();

  const lawyers = await prisma.user.findMany({
    where: { role: { in: CASE_HANDLER_ROLES }, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const serialized = {
    id: intake.id,
    requestNumber: intake.requestNumber,
    clientName: intake.clientName,
    clientPhone: intake.clientPhone,
    clientEmail: intake.clientEmail,
    clientIdNumber: intake.clientIdNumber,
    disputeSummary: intake.disputeSummary,
    opposingParty: intake.opposingParty,
    proposedType: intake.proposedType,
    source: intake.source,
    referredBy: intake.referredBy,
    receivedByName: intake.receivedBy.fullName,
    receivedAt: intake.receivedAt.toISOString(),
    status: intake.status,
    conflictResult: intake.conflictResult,
    conflictNotes: intake.conflictNotes,
    conflictCheckedAt: intake.conflictCheckedAt?.toISOString() ?? null,
    legalBasis: intake.legalBasis,
    strengths: intake.strengths,
    weaknesses: intake.weaknesses,
    jurisdiction: intake.jurisdiction,
    estimatedDuration: intake.estimatedDuration,
    proposedFee: intake.proposedFee ? Number(intake.proposedFee) : null,
    assessedAt: intake.assessedAt?.toISOString() ?? null,
    assessmentByName: intake.assessmentBy?.fullName ?? null,
    decision: intake.decision,
    decisionByName: intake.decisionBy?.fullName ?? null,
    rejectionReason: intake.rejectionReason,
    rejectionNotes: intake.rejectionNotes,
    feeAgreementSignedAt: intake.feeAgreementSignedAt?.toISOString() ?? null,
    advancePaymentReceived: intake.advancePaymentReceived,
    caseId: intake.case?.id ?? null,
    caseInternalNumber: intake.case?.internalNumber ?? null,
    documents: intake.documents.map((d) => ({
      id: d.id,
      title: d.title,
      storagePath: d.storagePath,
      uploadedByName: d.uploadedBy.fullName,
    })),
    notes: intake.notes.map((n) => ({
      id: n.id,
      content: n.content,
      authorName: n.author.fullName,
      createdAt: n.createdAt.toISOString(),
    })),
  };

  return (
    <IntakeDetailView
      intake={serialized}
      lawyers={lawyers}
      canAssess={canAssessIntake(session.user.role)}
      canActivate={canActivateIntake(session.user.role)}
    />
  );
}
