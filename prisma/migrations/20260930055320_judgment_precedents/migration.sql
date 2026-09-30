-- CreateEnum
CREATE TYPE "PrecedentSource" AS ENUM ('internal', 'external');

-- CreateTable
CREATE TABLE "judgment_precedents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "principle" TEXT NOT NULL,
    "fullText" TEXT,
    "court" TEXT,
    "caseType" "CaseType" NOT NULL,
    "degree" "VerdictDegree",
    "result" "VerdictResult",
    "judgmentNumber" TEXT,
    "judgmentDate" TIMESTAMP(3),
    "keywords" TEXT[],
    "source" "PrecedentSource" NOT NULL DEFAULT 'internal',
    "sourceCaseId" TEXT,
    "sourceVerdictId" TEXT,
    "attachmentKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judgment_precedents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "judgment_precedents_caseType_idx" ON "judgment_precedents"("caseType");

-- AddForeignKey
ALTER TABLE "judgment_precedents" ADD CONSTRAINT "judgment_precedents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
