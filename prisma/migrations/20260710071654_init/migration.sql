-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('partner', 'senior_lawyer', 'lawyer', 'secretary', 'accountant');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('individual', 'company');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('prospect', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "AgencyType" AS ENUM ('general', 'special');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('commercial', 'labor', 'personal_status', 'criminal', 'arbitration', 'debt_collection', 'other');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('intake', 'amicable_settlement', 'settled_amicably', 'open', 'in_progress', 'on_hold', 'ruled_first_instance', 'appealed', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('plaintiff', 'defendant', 'third_party');

-- CreateEnum
CREATE TYPE "CaseTeamRole" AS ENUM ('lead', 'assistant', 'supervisor');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('deny', 'allow');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('case_team', 'partners_only', 'all_staff');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('contract', 'judicial', 'correspondence', 'settlement', 'internal_governance');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('negotiation_meeting', 'hearing', 'initial_listening', 'verdict', 'arbitration');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'held', 'postponed');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('due', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "LaborSettlementOutcome" AS ENUM ('pending', 'settled', 'failed');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('view', 'create', 'update', 'delete');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "twoFaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "type" "ClientType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalIdOrCr" TEXT,
    "nationality" TEXT,
    "representativeName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'prospect',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agencyNumber" TEXT NOT NULL,
    "agencyType" "AgencyType" NOT NULL,
    "scopeText" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "internalNumber" TEXT NOT NULL,
    "courtCaseNumber" TEXT,
    "title" TEXT NOT NULL,
    "caseType" "CaseType" NOT NULL,
    "courtName" TEXT,
    "claimValue" DECIMAL(14,2),
    "clientId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'intake',
    "openDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedDate" TIMESTAMP(3),
    "responsibleLawyerId" TEXT NOT NULL,
    "priority" "CasePriority" NOT NULL DEFAULT 'normal',
    "conflictCheckConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_parties" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,
    "name" TEXT NOT NULL,
    "linkedClientId" TEXT,

    CONSTRAINT "case_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_team_members" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleInCase" "CaseTeamRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_access_overrides" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessType" "AccessType" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "case_access_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "category" TEXT,
    "visibilityLevel" "DocumentVisibility" NOT NULL DEFAULT 'case_team',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "applicableCaseTypes" "CaseType"[],
    "content" TEXT NOT NULL,
    "placeholders" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "court" TEXT,
    "reminderBefore" INTEGER,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_minutes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "caseId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'due',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_settlement_requests" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "taradhiRequestNumber" TEXT,
    "sessionDate" TIMESTAMP(3),
    "mediatorName" TEXT,
    "outcome" "LaborSettlementOutcome" NOT NULL DEFAULT 'pending',
    "settlementDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_settlement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_nationalIdOrCr_key" ON "clients"("nationalIdOrCr");

-- CreateIndex
CREATE UNIQUE INDEX "cases_internalNumber_key" ON "cases"("internalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "case_team_members_caseId_userId_key" ON "case_team_members"("caseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "case_access_overrides_caseId_userId_key" ON "case_access_overrides"("caseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_minutes_sessionId_key" ON "session_minutes"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "labor_settlement_requests_caseId_key" ON "labor_settlement_requests"("caseId");

-- CreateIndex
CREATE INDEX "audit_log_resourceType_resourceId_idx" ON "audit_log"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_responsibleLawyerId_fkey" FOREIGN KEY ("responsibleLawyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_linkedClientId_fkey" FOREIGN KEY ("linkedClientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_members" ADD CONSTRAINT "case_team_members_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team_members" ADD CONSTRAINT "case_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_access_overrides" ADD CONSTRAINT "case_access_overrides_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_access_overrides" ADD CONSTRAINT "case_access_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_minutes" ADD CONSTRAINT "session_minutes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_minutes" ADD CONSTRAINT "session_minutes_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_settlement_requests" ADD CONSTRAINT "labor_settlement_requests_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_settlement_requests" ADD CONSTRAINT "labor_settlement_requests_settlementDocumentId_fkey" FOREIGN KEY ("settlementDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
