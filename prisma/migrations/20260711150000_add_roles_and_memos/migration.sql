-- CreateEnum
CREATE TYPE "MemoStatus" AS ENUM ('draft', 'submitted', 'changes_requested', 'approved', 'submitted_to_court');

-- AlterEnum
BEGIN;
CREATE TYPE "CaseTeamRole_new" AS ENUM ('supervisor', 'lawyer', 'researcher');
ALTER TABLE "case_team_members" ALTER COLUMN "roleInCase" TYPE "CaseTeamRole_new" USING ("roleInCase"::text::"CaseTeamRole_new");
ALTER TYPE "CaseTeamRole" RENAME TO "CaseTeamRole_old";
ALTER TYPE "CaseTeamRole_new" RENAME TO "CaseTeamRole";
DROP TYPE "public"."CaseTeamRole_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('system_admin', 'supervisor', 'lawyer', 'researcher', 'secretary', 'accountant');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- CreateTable
CREATE TABLE "legal_memos" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "memoType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "legalBasis" TEXT,
    "precedents" TEXT,
    "circulars" TEXT,
    "status" "MemoStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "authoredById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memo_reviews" (
    "id" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comments" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memo_reviews_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "legal_memos" ADD CONSTRAINT "legal_memos_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_memos" ADD CONSTRAINT "legal_memos_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_memos" ADD CONSTRAINT "legal_memos_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memo_reviews" ADD CONSTRAINT "memo_reviews_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "legal_memos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memo_reviews" ADD CONSTRAINT "memo_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

