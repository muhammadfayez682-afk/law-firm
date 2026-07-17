import type { IntakeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSaudiPhone } from "@/lib/validators";

export type DuplicateEntity = "client" | "intake" | "party" | "user";

export type DuplicateMatch = {
  entity: DuplicateEntity;
  id: string;
  name: string;
  /** سياق للعرض: "مسجّل كعميل" أو "طلب استلام INT-2026-0005" */
  context: string;
  /** رابط الانتقال للسجل (إن وُجد). */
  href?: string;
  /** معرّف العميل المرتبط — يُستخدم لزر «استخدام السجل الموجود». */
  clientId?: string;
  /** بيانات للتعبئة التلقائية عند «استخدام بياناته» (لسجلات العملاء). */
  idNumber?: string | null;
  phone?: string | null;
};

export type DuplicateType = "phone" | "national_id" | "agency_number";

export type DuplicateResult = {
  hasDuplicate: boolean;
  duplicateType: DuplicateType;
  existingIn: DuplicateMatch[];
  severity: "warning" | "error";
};

/** جسم استجابة 409 الموحّد عند اكتشاف تكرار. */
export function duplicatePayload(result: DuplicateResult) {
  return {
    error: "duplicate_detected",
    duplicateInfo: { type: result.duplicateType, existingIn: result.existingIn },
  };
}

/**
 * أطراف الاستلام التي يُطبَّق عليها فحص التكرار:
 * نستثني المرفوضة/الملغاة والطلبات المُفعَّلة (caseId != null) لأنها صارت عميلًا
 * فعليًا — ظهور الرقم فيها وفي العميل هو نفس الشخص لا تكرار حقيقي.
 */
const INACTIVE_INTAKE_STATUSES: IntakeStatus[] = ["rejected", "cancelled", "accepted"];
const INTAKE_DUP_FILTER: Prisma.IntakeRequestWhereInput = {
  caseId: null,
  status: { notIn: INACTIVE_INTAKE_STATUSES },
};

type ExcludeOpts = {
  excludeClientId?: string;
  excludeIntakeId?: string;
  excludePartyId?: string;
};

/** فحص شامل لرقم الجوال عبر العملاء وطلبات الاستلام وأطراف القضايا. */
export async function checkPhoneDuplicate(
  phone: string,
  opts: ExcludeOpts = {}
): Promise<DuplicateResult> {
  const normalized = normalizeSaudiPhone(phone.trim());
  const existingIn: DuplicateMatch[] = [];
  if (!normalized) {
    return { hasDuplicate: false, duplicateType: "phone", existingIn, severity: "warning" };
  }

  const [clients, intakes, parties] = await Promise.all([
    prisma.client.findMany({
      where: { phone: normalized, id: opts.excludeClientId ? { not: opts.excludeClientId } : undefined },
      select: { id: true, fullName: true, nationalIdOrCr: true, phone: true },
    }),
    prisma.intakeRequest.findMany({
      where: {
        clientPhone: normalized,
        ...INTAKE_DUP_FILTER,
        id: opts.excludeIntakeId ? { not: opts.excludeIntakeId } : undefined,
      },
      select: { id: true, clientName: true, requestNumber: true },
    }),
    prisma.caseParty.findMany({
      where: { phone: normalized, id: opts.excludePartyId ? { not: opts.excludePartyId } : undefined },
      select: { id: true, name: true, linkedClientId: true, case: { select: { internalNumber: true } } },
    }),
  ]);

  for (const c of clients) {
    existingIn.push({ entity: "client", id: c.id, name: c.fullName, context: "مسجّل كعميل", href: `/clients/${c.id}`, clientId: c.id, idNumber: c.nationalIdOrCr, phone: c.phone });
  }
  for (const i of intakes) {
    existingIn.push({ entity: "intake", id: i.id, name: i.clientName, context: `طلب استلام ${i.requestNumber}`, href: `/intake/${i.id}` });
  }
  for (const p of parties) {
    existingIn.push({
      entity: "party",
      id: p.id,
      name: p.name,
      context: `طرف في قضية ${p.case.internalNumber}`,
      clientId: p.linkedClientId ?? undefined,
      href: p.linkedClientId ? `/clients/${p.linkedClientId}` : undefined,
    });
  }

  return { hasDuplicate: existingIn.length > 0, duplicateType: "phone", existingIn, severity: "warning" };
}

/** فحص رقم الهوية/السجل عبر العملاء وطلبات الاستلام وأطراف القضايا. */
export async function checkIdentityDuplicate(
  idNumber: string,
  opts: ExcludeOpts = {}
): Promise<DuplicateResult> {
  const value = idNumber.trim();
  const existingIn: DuplicateMatch[] = [];
  if (!value) {
    return { hasDuplicate: false, duplicateType: "national_id", existingIn, severity: "warning" };
  }

  const [clients, intakes, parties] = await Promise.all([
    prisma.client.findMany({
      where: { nationalIdOrCr: value, id: opts.excludeClientId ? { not: opts.excludeClientId } : undefined },
      select: { id: true, fullName: true, nationalIdOrCr: true, phone: true },
    }),
    prisma.intakeRequest.findMany({
      where: {
        clientIdNumber: value,
        ...INTAKE_DUP_FILTER,
        id: opts.excludeIntakeId ? { not: opts.excludeIntakeId } : undefined,
      },
      select: { id: true, clientName: true, requestNumber: true },
    }),
    prisma.caseParty.findMany({
      where: { identityNumber: value, id: opts.excludePartyId ? { not: opts.excludePartyId } : undefined },
      select: { id: true, name: true, linkedClientId: true, case: { select: { internalNumber: true } } },
    }),
  ]);

  for (const c of clients) {
    existingIn.push({ entity: "client", id: c.id, name: c.fullName, context: "مسجّل كعميل", href: `/clients/${c.id}`, clientId: c.id, idNumber: c.nationalIdOrCr, phone: c.phone });
  }
  for (const i of intakes) {
    existingIn.push({ entity: "intake", id: i.id, name: i.clientName, context: `طلب استلام ${i.requestNumber}`, href: `/intake/${i.id}` });
  }
  for (const p of parties) {
    existingIn.push({
      entity: "party",
      id: p.id,
      name: p.name,
      context: `طرف في قضية ${p.case.internalNumber}`,
      clientId: p.linkedClientId ?? undefined,
      href: p.linkedClientId ? `/clients/${p.linkedClientId}` : undefined,
    });
  }

  return { hasDuplicate: existingIn.length > 0, duplicateType: "national_id", existingIn, severity: "warning" };
}

/** فحص رقم الوكالة عبر الوكالات المسجّلة. */
export async function checkAgencyDuplicate(
  agencyNumber: string,
  excludeAgencyId?: string
): Promise<DuplicateResult> {
  const value = agencyNumber.trim();
  const existingIn: DuplicateMatch[] = [];
  if (!value) {
    return { hasDuplicate: false, duplicateType: "agency_number", existingIn, severity: "warning" };
  }

  const agencies = await prisma.agency.findMany({
    where: { agencyNumber: value, id: excludeAgencyId ? { not: excludeAgencyId } : undefined },
    select: { id: true, clientId: true, client: { select: { fullName: true } } },
  });
  for (const a of agencies) {
    existingIn.push({
      entity: "client",
      id: a.id,
      name: a.client.fullName,
      context: "وكالة مسجّلة لعميل",
      clientId: a.clientId,
      href: `/clients/${a.clientId}`,
    });
  }

  return { hasDuplicate: existingIn.length > 0, duplicateType: "agency_number", existingIn, severity: "warning" };
}
