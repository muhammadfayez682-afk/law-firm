-- CreateEnum
CREATE TYPE "VerdictDegree" AS ENUM ('first_instance', 'appeal', 'supreme');

-- CreateEnum
CREATE TYPE "VerdictResult" AS ENUM ('in_favor', 'against', 'partial');

-- CreateEnum
CREATE TYPE "VerdictFinality" AS ENUM ('pending_finality', 'final_binding');

-- CreateEnum
CREATE TYPE "CaseClosureReason" AS ENUM ('verdict', 'settlement', 'withdrawal', 'dismissal');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'verdict_recorded';
ALTER TYPE "NotificationType" ADD VALUE 'finality_suggested';
ALTER TYPE "NotificationType" ADD VALUE 'finality_confirmed';
ALTER TYPE "NotificationType" ADD VALUE 'case_closed';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "closureNote" TEXT,
ADD COLUMN     "closureReason" "CaseClosureReason";

-- CreateTable
CREATE TABLE "verdicts" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "degree" "VerdictDegree" NOT NULL,
    "result" "VerdictResult" NOT NULL,
    "verdictNumber" TEXT NOT NULL,
    "verdictDate" TIMESTAMP(3) NOT NULL,
    "ruling" TEXT NOT NULL,
    "finality" "VerdictFinality" NOT NULL DEFAULT 'pending_finality',
    "finalityConfirmedById" TEXT,
    "finalityConfirmedAt" TIMESTAMP(3),
    "attachmentKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verdicts_caseId_degree_idx" ON "verdicts"("caseId", "degree");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
