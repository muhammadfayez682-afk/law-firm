-- AlterEnum
ALTER TYPE "CaseStatus" ADD VALUE 'pending_agency';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'agency_pending_reminder';
ALTER TYPE "NotificationType" ADD VALUE 'agency_pending_urgent';
ALTER TYPE "NotificationType" ADD VALUE 'agency_delayed';
ALTER TYPE "NotificationType" ADD VALUE 'agency_issued';

-- AlterTable
ALTER TABLE "intake_requests" ADD COLUMN     "agencyExpectedDate" TIMESTAMP(3);
