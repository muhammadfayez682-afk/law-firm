-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PartyRole" ADD VALUE 'appellant';
ALTER TYPE "PartyRole" ADD VALUE 'appellee';
ALTER TYPE "PartyRole" ADD VALUE 'petitioner';
ALTER TYPE "PartyRole" ADD VALUE 'respondent';

-- AlterTable
ALTER TABLE "case_parties" ADD COLUMN     "address" TEXT,
ADD COLUMN     "identityNumber" TEXT,
ADD COLUMN     "isOurClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "opposingCounsel" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "clientPartyRole" "PartyRole";
