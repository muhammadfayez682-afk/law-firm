-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'intake_assessment_ready';
ALTER TYPE "NotificationType" ADD VALUE 'intake_assessment_approved';

-- AlterTable
ALTER TABLE "intake_requests" ADD COLUMN     "assessmentApprovedAt" TIMESTAMP(3),
ADD COLUMN     "assessmentApprovedById" TEXT;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_assessmentApprovedById_fkey" FOREIGN KEY ("assessmentApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
