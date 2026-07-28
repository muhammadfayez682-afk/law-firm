-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'session_memo_required';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "memoId" TEXT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "legal_memos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
