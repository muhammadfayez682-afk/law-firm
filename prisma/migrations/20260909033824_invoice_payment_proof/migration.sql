-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentProofKey" TEXT;
