-- CreateEnum
CREATE TYPE "ServiceTeamRole" AS ENUM ('lead', 'co');

-- DropForeignKey
ALTER TABLE "legal_services" DROP CONSTRAINT "legal_services_clientId_fkey";

-- AlterTable
ALTER TABLE "legal_services" ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "service_team_members" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleInService" "ServiceTeamRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_team_members_userId_idx" ON "service_team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "service_team_members_serviceId_userId_key" ON "service_team_members"("serviceId", "userId");

-- AddForeignKey
ALTER TABLE "service_team_members" ADD CONSTRAINT "service_team_members_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "legal_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_team_members" ADD CONSTRAINT "service_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_services" ADD CONSTRAINT "legal_services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: أنشئ صف فريق (lead) لكل دراسة موجودة من مسؤولها الحالي (assignedToId)
-- كي لا تفقد الخدمات الحالية إسنادها بعد تحويل الإسناد المفرد إلى فريق.
INSERT INTO "service_team_members" ("id", "serviceId", "userId", "roleInService", "assignedAt")
SELECT gen_random_uuid(), "id", "assignedToId", 'lead', now()
FROM "legal_services";
