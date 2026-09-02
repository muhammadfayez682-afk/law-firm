-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "storagePath" DROP NOT NULL;

-- AlterTable
ALTER TABLE "intake_documents" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "storagePath" DROP NOT NULL;

-- AlterTable
ALTER TABLE "service_documents" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "storagePath" DROP NOT NULL;
