-- CreateEnum
CREATE TYPE "DelegatedPermission" AS ENUM ('edit_case', 'manage_team', 'assign_tasks', 'write_memo', 'manage_timeline');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'delegation_granted';
ALTER TYPE "NotificationType" ADD VALUE 'delegation_revoked';

-- CreateTable
CREATE TABLE "permission_delegations" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedToId" TEXT NOT NULL,
    "permission" "DelegatedPermission" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permission_delegations_caseId_grantedToId_idx" ON "permission_delegations"("caseId", "grantedToId");

-- AddForeignKey
ALTER TABLE "permission_delegations" ADD CONSTRAINT "permission_delegations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_delegations" ADD CONSTRAINT "permission_delegations_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_delegations" ADD CONSTRAINT "permission_delegations_grantedToId_fkey" FOREIGN KEY ("grantedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
