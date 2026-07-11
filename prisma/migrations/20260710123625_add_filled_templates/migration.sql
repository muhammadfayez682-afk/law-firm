-- CreateTable
CREATE TABLE "filled_templates" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "caseId" TEXT,
    "sessionId" TEXT,
    "filledBy" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filled_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "filled_templates_templateKey_idx" ON "filled_templates"("templateKey");

-- CreateIndex
CREATE INDEX "filled_templates_caseId_idx" ON "filled_templates"("caseId");

-- AddForeignKey
ALTER TABLE "filled_templates" ADD CONSTRAINT "filled_templates_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filled_templates" ADD CONSTRAINT "filled_templates_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filled_templates" ADD CONSTRAINT "filled_templates_filledBy_fkey" FOREIGN KEY ("filledBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
