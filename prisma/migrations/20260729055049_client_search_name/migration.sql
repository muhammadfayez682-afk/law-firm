-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "searchName" TEXT;

-- Backfill: searchName = normalizeArabic(fullName) — يطابق منطق src/lib/arabic.ts.
-- (إزالة التشكيل والتطويل، توحيد الألف/الياء/التاء المربوطة، ضغط المسافات، trim، lower)
UPDATE "clients"
SET "searchName" = lower(trim(regexp_replace(
  translate(
    regexp_replace("fullName", '[ًٌٍَُِّْٰـ]', '', 'g'),
    'أإآٱىة',
    'اااايه'
  ),
  '\s+', ' ', 'g'
)));

-- CreateIndex
CREATE INDEX "clients_searchName_idx" ON "clients"("searchName");
