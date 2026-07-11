-- CreateEnum
CREATE TYPE "CaseOutcome" AS ENUM ('won', 'lost', 'neutral');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "outcome" "CaseOutcome";
