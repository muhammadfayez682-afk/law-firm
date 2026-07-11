/*
  Warnings:

  - You are about to drop the `labor_settlement_requests` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SettlementPlatform" AS ENUM ('qiwa', 'taradhi');

-- CreateEnum
CREATE TYPE "SettlementOutcome" AS ENUM ('pending', 'settled', 'failed');

-- DropForeignKey
ALTER TABLE "labor_settlement_requests" DROP CONSTRAINT "labor_settlement_requests_caseId_fkey";

-- DropForeignKey
ALTER TABLE "labor_settlement_requests" DROP CONSTRAINT "labor_settlement_requests_settlementDocumentId_fkey";

-- DropTable
DROP TABLE "labor_settlement_requests";

-- DropEnum
DROP TYPE "LaborSettlementOutcome";

-- CreateTable
CREATE TABLE "amicable_settlements" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "platform" "SettlementPlatform" NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "requestNumber" TEXT,
    "firstSessionDate" TIMESTAMP(3),
    "deadlineDate" TIMESTAMP(3),
    "mediatorName" TEXT,
    "outcome" "SettlementOutcome" NOT NULL DEFAULT 'pending',
    "settlementDocumentId" TEXT,
    "failureDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amicable_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "amicable_settlements_caseId_key" ON "amicable_settlements"("caseId");

-- AddForeignKey
ALTER TABLE "amicable_settlements" ADD CONSTRAINT "amicable_settlements_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
