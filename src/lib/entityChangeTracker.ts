import type { ChangeReason, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TrackedEntityType = "case" | "client" | "agency" | "party" | "intake" | "memo";

export interface FieldChange {
  fieldName: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface TrackChangesOptions {
  entityType: TrackedEntityType;
  entityId: string;
  changes: FieldChange[];
  changedById: string;
  reason: ChangeReason;
  reasonNote: string;
  ipAddress?: string | null;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** تحويل أي قيمة إلى نص للتخزين (تواريخ ISO، كائنات JSON، وإلا String). */
export function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * يوثّق مجموعة تغييرات حقول لكيان واحد: سجل لكل حقل (بنفس batchId) + قيد في
 * audit_log العام. يقبل عميل معاملة (tx) ليُستدعى داخل معاملة تحديث الكيان.
 */
export async function trackEntityChanges(opts: TrackChangesOptions, db: Db = prisma): Promise<string> {
  const batchId = crypto.randomUUID();

  await db.entityChangeLog.createMany({
    data: opts.changes.map((change) => ({
      entityType: opts.entityType,
      entityId: opts.entityId,
      fieldName: change.fieldName,
      fieldLabel: change.fieldLabel,
      oldValue: serializeValue(change.oldValue),
      newValue: serializeValue(change.newValue),
      changedById: opts.changedById,
      changeReason: opts.reason,
      reasonNote: opts.reasonNote,
      ipAddress: opts.ipAddress ?? null,
      batchId,
    })),
  });

  // قيد في سجل التدقيق العام أيضًا (resourceType بالكيان، resourceId بالمعرّف).
  await db.auditLog.create({
    data: {
      userId: opts.changedById,
      action: "update",
      resourceType: opts.entityType,
      resourceId: opts.entityId,
      ipAddress: opts.ipAddress ?? null,
    },
  });

  return batchId;
}

/**
 * يقارن كائنًا قديمًا بقيم جديدة ويعيد الحقول التي تغيّرت فعليًا فقط.
 * المقارنة تُطبّع التواريخ والأرقام لتفادي فروق التمثيل (Date/Decimal/string).
 */
export function computeChanges<T extends Record<string, unknown>>(
  oldEntity: T,
  newValues: Partial<T>,
  fieldLabels: Partial<Record<keyof T, string>>
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const key in newValues) {
    if (!Object.prototype.hasOwnProperty.call(newValues, key)) continue;
    const oldV = oldEntity[key];
    const newV = newValues[key];
    if (!valuesEqual(oldV, newV)) {
      changes.push({
        fieldName: String(key),
        fieldLabel: fieldLabels[key] ?? String(key),
        oldValue: oldV,
        newValue: newV,
      });
    }
  }
  return changes;
}

/** مقارنة متسامحة: تُطبّع التواريخ والأرقام والفراغات قبل المقارنة. */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = a === "" ? null : a;
  const nb = b === "" ? null : b;
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  if (na instanceof Date || nb instanceof Date) {
    return new Date(na as string).getTime() === new Date(nb as string).getTime();
  }
  // أرقام قد تأتي كـ Decimal/number/string.
  if (!Number.isNaN(Number(na)) && !Number.isNaN(Number(nb))) {
    return Number(na) === Number(nb);
  }
  return String(na) === String(nb);
}
