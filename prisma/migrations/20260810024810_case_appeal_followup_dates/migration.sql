-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'appeal_deadline_soon';
ALTER TYPE "NotificationType" ADD VALUE 'appeal_deadline_urgent';
ALTER TYPE "NotificationType" ADD VALUE 'appeal_deadline_missing';
ALTER TYPE "NotificationType" ADD VALUE 'follow_up_reminder';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "appealDeadline" TIMESTAMP(3),
ADD COLUMN     "followUpDate" TIMESTAMP(3);
