-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'session_report_required';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "department" TEXT,
ADD COLUMN     "judge" TEXT;
