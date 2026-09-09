/**
 * ⚠️⚠️ سكربت تنظيف بيانات حسّاس — نظام قدوم الحقائق ⚠️⚠️
 *
 * يمسح كل البيانات التشغيلية ويُبقي: المستخدمين + تفضيلاتهم + المسارات القضائية
 * + النماذج المرجعية + تفضيلات الإشعارات. (انظر KEEP أدناه.)
 *
 * الاستخدام:
 *   معاينة فقط (لا حذف):   npx ts-node prisma/wipe-operational.ts --dry-run
 *   الحذف الفعلي:          npx ts-node prisma/wipe-operational.ts --confirm
 *
 * قبل أي حذف فعلي: يُصدَّر كل المستخدمين (بكل الحقول) إلى
 *   prisma/backups/backup-users-<timestamp>.json  (شبكة أمان للاستعادة).
 *
 * كل الحذف داخل معاملة واحدة ($transaction) — أي خطأ يُلغي كل شيء (لا مسح جزئي).
 * الترتيب يحترم المفاتيح الأجنبية (الأبناء قبل الآباء).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/* ─────────────────────────── التصنيف ─────────────────────────── */

// تبقى كما هي — لا تُمسّ إطلاقًا (للتوثيق فقط؛ السكربت لا يلمسها):
//   users · user_dashboard_preferences · case_flow_stages · templates · notification_preferences
const KEEP_TABLES = [
  "users",
  "user_dashboard_preferences",
  "case_flow_stages",
  "templates",
  "notification_preferences",
] as const;

/**
 * جداول تُمسح، بالترتيب الصحيح (أبناء ← آباء). `get` يعيد delegate العميل
 * (يقبل prisma أو tx) حتى نستخدم نفس القائمة للعدّ (dry-run) وللحذف داخل المعاملة.
 */
type WipeEntry = { table: string; get: (c: PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => { count: () => Promise<number>; deleteMany: (args?: object) => Promise<{ count: number }> } };

const WIPE: WipeEntry[] = [
  // ── المجموعة أ: أوراق/أبناء مباشرون ──
  { table: "task_comments", get: (c) => (c as any).taskComment },
  { table: "task_assignees", get: (c) => (c as any).taskAssignee },
  { table: "memo_reviews", get: (c) => (c as any).memoReview },
  { table: "session_reports", get: (c) => (c as any).sessionReport },
  { table: "session_preparation_tasks", get: (c) => (c as any).sessionPreparationTask },
  { table: "session_minutes", get: (c) => (c as any).sessionMinutes },
  { table: "intake_documents", get: (c) => (c as any).intakeDocument },
  { table: "intake_notes", get: (c) => (c as any).intakeNote },
  { table: "service_documents", get: (c) => (c as any).serviceDocument },
  { table: "service_notes", get: (c) => (c as any).serviceNote },
  { table: "case_parties", get: (c) => (c as any).caseParty },
  { table: "case_team_members", get: (c) => (c as any).caseTeamMember },
  { table: "case_access_overrides", get: (c) => (c as any).caseAccessOverride },
  { table: "permission_delegations", get: (c) => (c as any).permissionDelegation },
  { table: "case_timeline_events", get: (c) => (c as any).caseTimelineEvent },
  { table: "verdicts", get: (c) => (c as any).verdict },
  { table: "case_reopen_logs", get: (c) => (c as any).caseReopenLog },
  { table: "case_closure_requests", get: (c) => (c as any).caseClosureRequest },
  { table: "filled_templates", get: (c) => (c as any).filledTemplate },
  { table: "documents", get: (c) => (c as any).document },
  { table: "invoices", get: (c) => (c as any).invoice },
  { table: "expenses", get: (c) => (c as any).expense },
  { table: "amicable_settlements", get: (c) => (c as any).amicableSettlement },
  { table: "entity_change_log", get: (c) => (c as any).entityChangeLog },
  { table: "notifications", get: (c) => (c as any).notification },
  // ── المجموعة ب: كيانات وسطى ──
  { table: "sessions", get: (c) => (c as any).session }, // قبل legal_memos (Session.memoId → legal_memos)
  { table: "tasks", get: (c) => (c as any).task }, // قبل cases/legal_services/intake_requests
  { table: "legal_memos", get: (c) => (c as any).legalMemo },
  { table: "legal_services", get: (c) => (c as any).legalService },
  { table: "intake_requests", get: (c) => (c as any).intakeRequest },
  { table: "agencies", get: (c) => (c as any).agency },
  // ── المجموعة ج: آباء ──
  { table: "cases", get: (c) => (c as any).case },
  { table: "clients", get: (c) => (c as any).client },
  // ── المجموعة د: مستقل ──
  { table: "audit_log", get: (c) => (c as any).auditLog },
];

/* ─────────────────────────── أدوات ─────────────────────────── */

function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host || "(غير معروف)";
  } catch {
    return "(تعذّر قراءة DATABASE_URL)";
  }
}

async function backupUsers(): Promise<{ path: string; count: number }> {
  const users = await prisma.user.findMany(); // كل الحقول (تشمل كلمات المرور المجزّأة)
  const dir = join(process.cwd(), "prisma", "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `backup-users-${stamp}.json`);
  writeFileSync(path, JSON.stringify(users, null, 2), "utf8");
  return { path, count: users.length };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

/* ─────────────────────────── التنفيذ ─────────────────────────── */

async function main() {
  const args = new Set(process.argv.slice(2));
  const isDryRun = args.has("--dry-run");
  const isConfirmed = args.has("--confirm");

  console.log("════════════════════════════════════════════════════════");
  console.log("  تنظيف بيانات قدوم الحقائق — البيانات التشغيلية");
  console.log(`  قاعدة البيانات المستهدفة: ${dbHost()}`);
  console.log("════════════════════════════════════════════════════════");
  console.log(`\n✅ يبقى دون مساس (${KEEP_TABLES.length}): ${KEEP_TABLES.join(", ")}\n`);

  // 1) عدّ كل جدول سيُمسح (للمعاينة والتقرير).
  console.log("جرد الجداول التي ستُمسح:");
  let total = 0;
  const counts: { table: string; count: number }[] = [];
  for (const w of WIPE) {
    const n = await w.get(prisma).count();
    counts.push({ table: w.table, count: n });
    total += n;
    console.log(`  ${pad(w.table, 30)} ${n}`);
  }
  console.log(`  ${pad("— الإجمالي —", 30)} ${total}\n`);

  // 2) وضع المعاينة: توقّف هنا بلا حذف.
  if (isDryRun || !isConfirmed) {
    if (!isDryRun && !isConfirmed) {
      console.log("⛔ لم يُحذف شيء. هذا وضع آمن افتراضي.");
      console.log("   للمعاينة فقط:  npx ts-node prisma/wipe-operational.ts --dry-run");
      console.log("   للحذف الفعلي: npx ts-node prisma/wipe-operational.ts --confirm");
    } else {
      console.log("⛔ وضع المعاينة (--dry-run): لم يُحذف أي سجل.");
    }
    await prisma.$disconnect();
    return;
  }

  // 3) الحذف الفعلي (--confirm): نسخة احتياطية للمستخدمين أولًا.
  console.log("🛟 تصدير نسخة احتياطية للمستخدمين قبل الحذف...");
  const backup = await backupUsers();
  console.log(`   حُفظت ${backup.count} مستخدمًا في:\n   ${backup.path}\n`);

  // 4) الحذف داخل معاملة واحدة بالترتيب — أي خطأ يُلغي كل شيء.
  console.log("🗑️  بدء الحذف داخل معاملة واحدة...");
  const deleted: { table: string; count: number }[] = [];
  await prisma.$transaction(
    async (tx) => {
      for (const w of WIPE) {
        const r = await w.get(tx).deleteMany({});
        deleted.push({ table: w.table, count: r.count });
      }
    },
    { timeout: 5 * 60 * 1000, maxWait: 30 * 1000 },
  );

  let totalDeleted = 0;
  console.log("\nملخّص الحذف:");
  for (const d of deleted) {
    totalDeleted += d.count;
    console.log(`  ${pad(d.table, 30)} ${d.count}`);
  }
  console.log(`  ${pad("— إجمالي المحذوف —", 30)} ${totalDeleted}`);
  console.log(`\n✅ اكتمل. المستخدمون والإعدادات المرجعية سليمة.`);
  console.log(`   النسخة الاحتياطية: ${backup.path}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n❌ فشل التنظيف (رُوجعت المعاملة، لا مسح جزئي):");
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
