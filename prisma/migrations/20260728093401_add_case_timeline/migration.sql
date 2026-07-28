-- CreateEnum
CREATE TYPE "TimelineEventSource" AS ENUM ('template', 'manual');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'timeline_event_updated';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "case_timeline_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "eventDate" TIMESTAMP(3),
    "source" "TimelineEventSource" NOT NULL DEFAULT 'manual',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_timeline_events_caseId_sequence_idx" ON "case_timeline_events"("caseId", "sequence");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_timeline_events" ADD CONSTRAINT "case_timeline_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_timeline_events" ADD CONSTRAINT "case_timeline_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
