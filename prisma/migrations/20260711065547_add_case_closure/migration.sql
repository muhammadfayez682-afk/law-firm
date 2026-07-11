BEGIN;

-- CreateEnum
CREATE TYPE "ClosureReason" AS ENUM ('final_judgment', 'settlement', 'withdrawal', 'agency_revoked', 'statute_barred', 'other');

-- CreateEnum
CREATE TYPE "ClosureStatus" AS ENUM ('pending_approval', 'approved', 'rejected');

-- AlterEnum
CREATE TYPE "CaseOutcome_new" AS ENUM ('won_full', 'won_partial', 'lost', 'settled', 'withdrawn', 'dismissed', 'client_terminated');
ALTER TABLE "cases" ALTER COLUMN "outcome" TYPE "CaseOutcome_new" USING ("outcome"::text::"CaseOutcome_new");
ALTER TYPE "CaseOutcome" RENAME TO "CaseOutcome_old";
ALTER TYPE "CaseOutcome_new" RENAME TO "CaseOutcome";
DROP TYPE "public"."CaseOutcome_old";

-- AlterEnum
ALTER TYPE "CaseStatus" ADD VALUE 'pending_closure';

-- CreateTable
CREATE TABLE "case_closure_requests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "outcome" "CaseOutcome" NOT NULL,
    "closureReason" "ClosureReason" NOT NULL,
    "closureNotes" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ClosureStatus" NOT NULL DEFAULT 'pending_approval',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,

    CONSTRAINT "case_closure_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_reopen_logs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reopenedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reopenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_reopen_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_closure_requests_caseId_key" ON "case_closure_requests"("caseId");

-- AddForeignKey
ALTER TABLE "case_closure_requests" ADD CONSTRAINT "case_closure_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_closure_requests" ADD CONSTRAINT "case_closure_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_closure_requests" ADD CONSTRAINT "case_closure_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reopen_logs" ADD CONSTRAINT "case_reopen_logs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reopen_logs" ADD CONSTRAINT "case_reopen_logs_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
