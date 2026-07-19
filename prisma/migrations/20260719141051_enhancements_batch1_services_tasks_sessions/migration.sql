-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('in_person', 'remote', 'hybrid');

-- CreateEnum
CREATE TYPE "SessionPlatform" AS ENUM ('zoom', 'google_meet', 'microsoft_teams', 'najiz', 'qiwa', 'taradhi', 'other');

-- CreateEnum
CREATE TYPE "TaskAssigneeStatus" AS ENUM ('pending', 'in_progress', 'completed', 'declined');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('legal_consultation', 'company_formation', 'documentation', 'execution_request', 'contract_drafting', 'other');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('new', 'in_progress', 'pending_client', 'under_review', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ServicePriority" AS ENUM ('normal', 'high', 'urgent');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "meetingPassword" TEXT,
ADD COLUMN     "meetingPlatform" "SessionPlatform",
ADD COLUMN     "sessionMode" "SessionMode" NOT NULL DEFAULT 'in_person';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "serviceId" TEXT;

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TaskAssigneeStatus" NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_services" (
    "id" TEXT NOT NULL,
    "serviceNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "description" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'new',
    "priority" "ServicePriority" NOT NULL DEFAULT 'normal',
    "assignedToId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deliverable" TEXT,
    "deliverableNotes" TEXT,
    "fee" DECIMAL(12,2),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_documents" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_notes" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignees_userId_status_idx" ON "task_assignees"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_userId_key" ON "task_assignees"("taskId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_services_serviceNumber_key" ON "legal_services"("serviceNumber");

-- CreateIndex
CREATE INDEX "legal_services_assignedToId_status_idx" ON "legal_services"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "legal_services_clientId_idx" ON "legal_services"("clientId");

-- CreateIndex
CREATE INDEX "tasks_serviceId_idx" ON "tasks"("serviceId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "legal_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_services" ADD CONSTRAINT "legal_services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_services" ADD CONSTRAINT "legal_services_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_services" ADD CONSTRAINT "legal_services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_documents" ADD CONSTRAINT "service_documents_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "legal_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_documents" ADD CONSTRAINT "service_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_notes" ADD CONSTRAINT "service_notes_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "legal_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_notes" ADD CONSTRAINT "service_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
