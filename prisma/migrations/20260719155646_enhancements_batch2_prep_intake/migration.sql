-- CreateEnum
CREATE TYPE "PrepTaskType" AS ENUM ('team_meeting', 'client_contact', 'najiz_review', 'agency_verification', 'memos_review', 'documents_review', 'external_review', 'strategy_alignment', 'other');

-- CreateEnum
CREATE TYPE "IntakeKind" AS ENUM ('case', 'service');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'session_prep_reminder';
ALTER TYPE "NotificationType" ADD VALUE 'session_prep_urgent';
ALTER TYPE "NotificationType" ADD VALUE 'session_prep_critical';

-- AlterTable
ALTER TABLE "intake_requests" ADD COLUMN     "existingClientId" TEXT,
ADD COLUMN     "proposedServiceType" "ServiceType",
ADD COLUMN     "relatedCaseId" TEXT,
ADD COLUMN     "requestKind" "IntakeKind" NOT NULL DEFAULT 'case';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "prepChecklistGenerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "session_preparation_tasks" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "taskType" "PrepTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_preparation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_preparation_tasks_sessionId_idx" ON "session_preparation_tasks"("sessionId");

-- AddForeignKey
ALTER TABLE "session_preparation_tasks" ADD CONSTRAINT "session_preparation_tasks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_preparation_tasks" ADD CONSTRAINT "session_preparation_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_existingClientId_fkey" FOREIGN KEY ("existingClientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
