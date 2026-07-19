import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/rbac";
import {
  isValidNationalIdOrCr,
  isValidSaudiPhone,
  nationalIdOrCrError,
  normalizeSaudiPhone,
  VALIDATION_MESSAGES,
} from "@/lib/validators";
import { checkIdentityDuplicate, checkPhoneDuplicate, duplicatePayload } from "@/lib/duplicateCheck";
import type { ChangeReason, Prisma } from "@prisma/client";
import { canEditField, EDIT_FIELD_LABELS, CHANGE_REASON_LABELS_AR } from "@/lib/editPermissions";
import { trackEntityChanges, type FieldChange } from "@/lib/entityChangeTracker";

type Params = { params: Promise<{ id: string }> };

const CLIENT_EDITABLE_FIELDS = ["fullName", "nationalIdOrCr", "phone", "email", "representativeName"] as const;

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      agencies: { orderBy: { expiryDate: "asc" } },
      cases: {
        orderBy: { createdAt: "desc" },
        include: { responsibleLawyer: true, team: true, accessOverrides: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
  }

  if (!canAccessClient(session.user, client)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذا العميل" }, { status: 403 });
  }

  return NextResponse.json(client);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (session.user.role === "accountant") {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل بيانات العملاء" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.client.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
  }

  const body = await request.json();

  // ===== مسار التعديل الموحّد الموثّق =====
  if (body.changes && typeof body.changes === "object") {
    const changesInput = body.changes as Record<string, unknown>;
    const reason = body.reason as ChangeReason;
    const reasonNote = typeof body.reasonNote === "string" ? body.reasonNote.trim() : "";
    if (!reason || !(reason in CHANGE_REASON_LABELS_AR)) {
      return NextResponse.json({ error: "سبب التعديل مطلوب" }, { status: 400 });
    }
    if (reasonNote.length < 30) {
      return NextResponse.json({ error: "الملاحظة التوضيحية يجب أن تكون 30 حرفًا على الأقل" }, { status: 400 });
    }

    const data: Prisma.ClientUpdateInput = {};
    const fieldChanges: FieldChange[] = [];
    const force = body.force === true;

    for (const key of Object.keys(changesInput)) {
      if (!CLIENT_EDITABLE_FIELDS.includes(key as (typeof CLIENT_EDITABLE_FIELDS)[number])) {
        return NextResponse.json({ error: `حقل غير قابل للتعديل: ${key}` }, { status: 400 });
      }
      const check = canEditField("client", key, session.user.role, {});
      if (!check.allowed) {
        return NextResponse.json({ error: check.reason ?? "لا تملك صلاحية تعديل هذا الحقل" }, { status: 403 });
      }
      let raw = changesInput[key];

      if (key === "phone" && raw) {
        raw = normalizeSaudiPhone(String(raw).trim());
        if (!isValidSaudiPhone(String(raw))) {
          return NextResponse.json({ error: VALIDATION_MESSAGES.phone }, { status: 400 });
        }
        if (!force && raw !== existing.phone) {
          const dup = await checkPhoneDuplicate(String(raw), { excludeClientId: id });
          if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
        }
      }
      if (key === "nationalIdOrCr" && raw) {
        const v = String(raw).trim();
        if (!isValidNationalIdOrCr(v, existing.type)) {
          return NextResponse.json({ error: nationalIdOrCrError(existing.type) }, { status: 400 });
        }
        if (!force && v !== existing.nationalIdOrCr) {
          const dup = await checkIdentityDuplicate(v, { excludeClientId: id });
          if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
        }
        raw = v;
      }

      (data as Record<string, unknown>)[key] = raw === "" ? null : raw;
      fieldChanges.push({
        fieldName: key,
        fieldLabel: EDIT_FIELD_LABELS[key] ?? key,
        oldValue: (existing as unknown as Record<string, unknown>)[key],
        newValue: raw,
      });
    }

    if (fieldChanges.length === 0) {
      return NextResponse.json({ error: "لا توجد تغييرات" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.client.update({ where: { id }, data });
      await trackEntityChanges(
        { entityType: "client", entityId: id, changes: fieldChanges, changedById: session.user.id, reason, reasonNote, ipAddress: ip },
        tx
      );
      return u;
    });
    return NextResponse.json(result);
  }

  const idValue = typeof body.nationalIdOrCr === "string" ? body.nationalIdOrCr.trim() : "";
  if (idValue && !isValidNationalIdOrCr(idValue, existing.type)) {
    return NextResponse.json({ error: nationalIdOrCrError(existing.type) }, { status: 400 });
  }
  const phoneValue = typeof body.phone === "string" ? normalizeSaudiPhone(body.phone.trim()) : "";
  if (phoneValue && !isValidSaudiPhone(phoneValue)) {
    return NextResponse.json({ error: VALIDATION_MESSAGES.phone }, { status: 400 });
  }

  const force = body.force === true;
  // فحص التكرار مع استثناء السجل نفسه (excludeClientId).
  if (!force) {
    if (phoneValue && phoneValue !== existing.phone) {
      const dup = await checkPhoneDuplicate(phoneValue, { excludeClientId: id });
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
    if (idValue && idValue !== existing.nationalIdOrCr) {
      const dup = await checkIdentityDuplicate(idValue, { excludeClientId: id });
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
  }

  const updated = await prisma.client.update({
    where: { id },
    data: {
      fullName: body.fullName ?? undefined,
      nationalIdOrCr: body.nationalIdOrCr ?? undefined,
      nationality: body.nationality ?? undefined,
      representativeName: body.representativeName ?? undefined,
      phone: body.phone !== undefined ? phoneValue || null : undefined,
      email: body.email ?? undefined,
      status: body.status ?? undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "Client",
      resourceId: id,
    },
  });

  return NextResponse.json(updated);
}
