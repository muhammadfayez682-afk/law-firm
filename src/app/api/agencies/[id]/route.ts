import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { AgencyType, ChangeReason, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessClient } from "@/lib/rbac";
import { isValidAgencyNumber, VALIDATION_MESSAGES } from "@/lib/validators";
import { canEditField, EDIT_FIELD_LABELS, CHANGE_REASON_LABELS_AR } from "@/lib/editPermissions";
import { trackEntityChanges, type FieldChange } from "@/lib/entityChangeTracker";

type Params = { params: Promise<{ id: string }> };

const AGENCY_EDITABLE_FIELDS = ["agencyNumber", "agencyType", "scopeText", "issueDate", "expiryDate"] as const;

/** تعديل بيانات وكالة (موثّق). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const agency = await prisma.agency.findUnique({
    where: { id },
    include: { client: { include: { cases: { include: { team: true, accessOverrides: true } } } } },
  });
  if (!agency) {
    return NextResponse.json({ error: "الوكالة غير موجودة" }, { status: 404 });
  }
  if (!canAccessClient(session.user, agency.client) || session.user.role === "accountant") {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه الوكالة" }, { status: 403 });
  }

  const body = await request.json();
  const changesInput = (body.changes ?? {}) as Record<string, unknown>;
  const reason = body.reason as ChangeReason;
  const reasonNote = typeof body.reasonNote === "string" ? body.reasonNote.trim() : "";

  if (!reason || !(reason in CHANGE_REASON_LABELS_AR)) {
    return NextResponse.json({ error: "سبب التعديل مطلوب" }, { status: 400 });
  }
  if (reasonNote.length < 30) {
    return NextResponse.json({ error: "الملاحظة التوضيحية يجب أن تكون 30 حرفًا على الأقل" }, { status: 400 });
  }

  const data: Prisma.AgencyUpdateInput = {};
  const fieldChanges: FieldChange[] = [];

  for (const key of Object.keys(changesInput)) {
    if (!AGENCY_EDITABLE_FIELDS.includes(key as (typeof AGENCY_EDITABLE_FIELDS)[number])) {
      return NextResponse.json({ error: `حقل غير قابل للتعديل: ${key}` }, { status: 400 });
    }
    const check = canEditField("agency", key, session.user.role, {});
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason ?? "لا تملك صلاحية تعديل هذا الحقل" }, { status: 403 });
    }
    const raw = changesInput[key];

    if (key === "agencyNumber") {
      if (!raw || !isValidAgencyNumber(String(raw).trim())) {
        return NextResponse.json({ error: VALIDATION_MESSAGES.agency }, { status: 400 });
      }
      (data as Record<string, unknown>).agencyNumber = String(raw).trim();
    } else if (key === "agencyType") {
      (data as Record<string, unknown>).agencyType = raw as AgencyType;
    } else if (key === "issueDate" || key === "expiryDate") {
      (data as Record<string, unknown>)[key] = new Date(String(raw));
    } else {
      (data as Record<string, unknown>)[key] = raw === "" ? null : raw;
    }

    fieldChanges.push({
      fieldName: key,
      fieldLabel: EDIT_FIELD_LABELS[key] ?? key,
      oldValue: (agency as unknown as Record<string, unknown>)[key],
      newValue: raw,
    });
  }

  if (fieldChanges.length === 0) {
    return NextResponse.json({ error: "لا توجد تغييرات" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await prisma.$transaction(async (tx) => {
    const u = await tx.agency.update({ where: { id }, data });
    await trackEntityChanges(
      { entityType: "agency", entityId: id, changes: fieldChanges, changedById: session.user.id, reason, reasonNote, ipAddress: ip },
      tx
    );
    return u;
  });

  return NextResponse.json(result);
}
