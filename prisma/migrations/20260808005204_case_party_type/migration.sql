-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('individual', 'company', 'government');

-- AlterTable
ALTER TABLE "case_parties" ADD COLUMN     "partyType" "PartyType" NOT NULL DEFAULT 'individual';
