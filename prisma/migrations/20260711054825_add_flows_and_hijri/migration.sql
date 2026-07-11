-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CaseType" ADD VALUE 'general';
ALTER TYPE "CaseType" ADD VALUE 'administrative';
ALTER TYPE "CaseType" ADD VALUE 'committee';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "hijriDate" TEXT;

-- CreateTable
CREATE TABLE "case_flow_stages" (
    "id" TEXT NOT NULL,
    "caseType" "CaseType" NOT NULL,
    "order" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "authority" TEXT,
    "platformUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "case_flow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_flow_stages_caseType_order_key" ON "case_flow_stages"("caseType", "order");
