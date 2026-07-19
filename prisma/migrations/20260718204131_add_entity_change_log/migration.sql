-- CreateEnum
CREATE TYPE "ChangeReason" AS ENUM ('data_entry_error', 'official_update', 'client_information_change', 'legal_correction', 'system_migration', 'other');

-- AlterTable
ALTER TABLE "legal_memos" ADD COLUMN     "parentMemoId" TEXT;

-- CreateTable
CREATE TABLE "entity_change_log" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT NOT NULL,
    "changeReason" "ChangeReason" NOT NULL,
    "reasonNote" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "batchId" TEXT,

    CONSTRAINT "entity_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_change_log_entityType_entityId_changedAt_idx" ON "entity_change_log"("entityType", "entityId", "changedAt");

-- CreateIndex
CREATE INDEX "entity_change_log_changedById_changedAt_idx" ON "entity_change_log"("changedById", "changedAt");

-- AddForeignKey
ALTER TABLE "legal_memos" ADD CONSTRAINT "legal_memos_parentMemoId_fkey" FOREIGN KEY ("parentMemoId") REFERENCES "legal_memos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_change_log" ADD CONSTRAINT "entity_change_log_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
