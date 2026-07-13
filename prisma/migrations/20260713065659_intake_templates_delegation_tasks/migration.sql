-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'overdue');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('case_related', 'administrative', 'research', 'document_preparation', 'meeting', 'follow_up', 'personal', 'other');

-- AlterTable
ALTER TABLE "filled_templates" ADD COLUMN     "intakeId" TEXT;

-- AlterTable
ALTER TABLE "intake_requests" ADD COLUMN     "assessmentDelegatedAt" TIMESTAMP(3),
ADD COLUMN     "assessmentDelegatedById" TEXT,
ADD COLUMN     "assessmentDelegatedToId" TEXT;

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "taskNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "caseId" TEXT,
    "intakeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "completionNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_taskNumber_key" ON "tasks"("taskNumber");

-- CreateIndex
CREATE INDEX "tasks_assignedToId_status_idx" ON "tasks"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "tasks_caseId_idx" ON "tasks"("caseId");

-- CreateIndex
CREATE INDEX "tasks_intakeId_idx" ON "tasks"("intakeId");

-- CreateIndex
CREATE INDEX "filled_templates_intakeId_idx" ON "filled_templates"("intakeId");

-- AddForeignKey
ALTER TABLE "filled_templates" ADD CONSTRAINT "filled_templates_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intake_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_assessmentDelegatedToId_fkey" FOREIGN KEY ("assessmentDelegatedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_assessmentDelegatedById_fkey" FOREIGN KEY ("assessmentDelegatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intake_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
