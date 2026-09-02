/**
 * سكربت ترحيل المستندات من القرص المحلي (public/uploads) إلى Cloudflare R2.
 *
 * ⚠️ لا يُشغَّل تلقائيًا. شغّله يدويًا حيث تكون الملفات موجودة فعليًا على القرص:
 *     npx ts-node scripts/migrate-docs-to-r2.ts            # تنفيذ فعلي
 *     npx ts-node scripts/migrate-docs-to-r2.ts --dry-run  # عرض فقط دون رفع/تحديث
 *
 * لكل مستند له storagePath (قرص محلي) وبلا storageKey (R2):
 *   يقرأ الملف من public/<storagePath> → يرفعه لـ R2 → يضبط storageKey ويُفرّغ storagePath.
 * المستندات التي لها storageKey مسبقًا تُتخطّى (مُرحّلة). يبقى storagePath للسجلات التي يتعذّر
 * إيجاد ملفها على القرص (لا يُلمس) حتى تُعالَج يدويًا.
 *
 * ملاحظة: على Railway القرص عابر (يُمحى عند كل إعادة نشر)، فقد لا توجد ملفات لترحيلها هناك.
 */
import { readFile } from "fs/promises";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { uploadToR2, buildDocumentKey, isR2Configured } from "../src/lib/r2";

const DRY_RUN = process.argv.includes("--dry-run");
const PUBLIC_ROOT = path.join(process.cwd(), "public");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function scopeFor(storagePath: string): "cases" | "intake" | "services" | "general" {
  if (storagePath.startsWith("/uploads/intake/")) return "intake";
  if (storagePath.startsWith("/uploads/services/")) return "services";
  if (storagePath.startsWith("/uploads/general/")) return "general";
  return "cases";
}

async function migrateOne(
  label: string,
  id: string,
  storagePath: string | null,
  storageKey: string | null,
  ownerId: string,
  fileName: string,
  setKey: (key: string) => Promise<unknown>,
): Promise<"skipped" | "migrated" | "missing"> {
  if (storageKey) return "skipped"; // مُرحّل
  if (!storagePath) return "skipped";
  const abs = path.join(PUBLIC_ROOT, storagePath.replace(/^\//, ""));
  let buffer: Buffer;
  try {
    buffer = await readFile(abs);
  } catch {
    console.warn(`  ⚠️  ${label} ${id}: الملف غير موجود على القرص (${storagePath}) — تُرك دون ترحيل`);
    return "missing";
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] ${label} ${id}: سيُرفع ${storagePath} (${buffer.length} bytes)`);
    return "migrated";
  }
  const key = await uploadToR2(buildDocumentKey(scopeFor(storagePath), ownerId, fileName), buffer);
  await setKey(key);
  console.log(`  ✓ ${label} ${id} → ${key}`);
  return "migrated";
}

async function main() {
  if (!DRY_RUN && !isR2Configured()) {
    console.error("R2 غير مهيأ: اضبط متغيرات R2_* قبل التشغيل الفعلي.");
    process.exit(1);
  }

  const stats = { migrated: 0, skipped: 0, missing: 0 };
  const bump = (r: "skipped" | "migrated" | "missing") => (stats[r] += 1);

  const documents = await prisma.document.findMany({ where: { storageKey: null, storagePath: { not: null } } });
  console.log(`\nمستندات القضايا: ${documents.length}`);
  for (const d of documents) {
    bump(await migrateOne("Document", d.id, d.storagePath, d.storageKey, d.caseId ?? "general", d.fileName,
      (key) => prisma.document.update({ where: { id: d.id }, data: { storageKey: key, storagePath: null } })));
  }

  const intakeDocs = await prisma.intakeDocument.findMany({ where: { storageKey: null, storagePath: { not: null } } });
  console.log(`مستندات الاستلام: ${intakeDocs.length}`);
  for (const d of intakeDocs) {
    bump(await migrateOne("IntakeDocument", d.id, d.storagePath, d.storageKey, d.intakeId, d.title,
      (key) => prisma.intakeDocument.update({ where: { id: d.id }, data: { storageKey: key, storagePath: null } })));
  }

  const serviceDocs = await prisma.serviceDocument.findMany({ where: { storageKey: null, storagePath: { not: null } } });
  console.log(`مستندات الخدمات: ${serviceDocs.length}`);
  for (const d of serviceDocs) {
    bump(await migrateOne("ServiceDocument", d.id, d.storagePath, d.storageKey, d.serviceId, d.title,
      (key) => prisma.serviceDocument.update({ where: { id: d.id }, data: { storageKey: key, storagePath: null } })));
  }

  console.log(`\nالخلاصة${DRY_RUN ? " (dry-run)" : ""}: رُحّل ${stats.migrated} · تُخطّي ${stats.skipped} · مفقود ${stats.missing}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
