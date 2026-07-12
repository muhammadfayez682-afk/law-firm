-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('received', 'conflict_check', 'under_assessment', 'fee_agreement_pending', 'accepted', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "IntakeSource" AS ENUM ('referral_client', 'referral_lawyer', 'website', 'advertisement', 'personal_network', 'walk_in', 'other');

-- CreateEnum
CREATE TYPE "ConflictCheckResult" AS ENUM ('pending', 'clear', 'potential', 'confirmed');

-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('conflict_of_interest', 'outside_expertise', 'weak_legal_position', 'fee_disagreement', 'client_withdrew', 'capacity', 'other');

-- CreateTable
CREATE TABLE "intake_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientIdNumber" TEXT,
    "disputeSummary" TEXT NOT NULL,
    "opposingParty" TEXT,
    "proposedType" "CaseType",
    "source" "IntakeSource" NOT NULL,
    "referredBy" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "IntakeStatus" NOT NULL DEFAULT 'received',
    "conflictResult" "ConflictCheckResult" NOT NULL DEFAULT 'pending',
    "conflictNotes" TEXT,
    "conflictCheckedAt" TIMESTAMP(3),
    "assessmentById" TEXT,
    "legalBasis" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "jurisdiction" TEXT,
    "estimatedDuration" TEXT,
    "proposedFee" DECIMAL(12,2),
    "assessedAt" TIMESTAMP(3),
    "decision" TEXT,
    "decisionById" TEXT,
    "decisionAt" TIMESTAMP(3),
    "rejectionReason" "RejectionReason",
    "rejectionNotes" TEXT,
    "feeAgreementSignedAt" TIMESTAMP(3),
    "feeAgreementDocId" TEXT,
    "advancePaymentReceived" BOOLEAN NOT NULL DEFAULT false,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_documents" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_notes" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intake_requests_requestNumber_key" ON "intake_requests"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "intake_requests_caseId_key" ON "intake_requests"("caseId");

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_assessmentById_fkey" FOREIGN KEY ("assessmentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_decisionById_fkey" FOREIGN KEY ("decisionById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intake_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_documents" ADD CONSTRAINT "intake_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_notes" ADD CONSTRAINT "intake_notes_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intake_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_notes" ADD CONSTRAINT "intake_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
