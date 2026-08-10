import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CaseType, ChangeReason, PartyRole, Prisma } from "@prisma/client";
import { canAccessCase, canEditCase, isManagement, resolveCasePermission } from "@/lib/rbac";
import { canProceedToCourt } from "@/lib/caseFlow";
import { syncCaseDisplayNumber } from "@/lib/caseNumber.server";
import { notifyBulk } from "@/lib/notifications/send";
import { canEditField, EDIT_FIELD_LABELS, CHANGE_REASON_LABELS_AR } from "@/lib/editPermissions";
import { trackEntityChanges, type FieldChange } from "@/lib/entityChangeTracker";

type Params = { params: Promise<{ id: string }> };

/** ip المستخدم من ترويسات الطلب (لتوثيق التعديل). */
function clientIp(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

const CASE_EDITABLE_FIELDS = [
  "title",
  "courtCaseNumber",
  "courtName",
  "department",
  "judge",
  "caseType",
  "claimValue",
  "priority",
  "notes",
  "clientPartyRole",
] as const;

async function loadCaseForAccessCheck(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      team: true,
      accessOverrides: true,
      amicableSettlement: true,
      delegations: {
        select: {
          grantedToId: true,
          grantedById: true,
          permission: true,
          revokedAt: true,
          expiresAt: true,
          grantedBy: { select: { role: true } },
        },
      },
    },
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      client: true,
      responsibleLawyer: true,
      parties: { include: { linkedClient: true } },
      team: { include: { user: true } },
      accessOverrides: true,
      documents: { include: { uploadedBy: true } },
      sessions: { orderBy: { sessionDate: "asc" }, include: { minutes: true } },
      invoices: true,
      expenses: true,
      amicableSettlement: true,
    },
  });

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canAccessCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذه القضية" }, { status: 403 });
  }

  return NextResponse.json(caseData);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await loadCaseForAccessCheck(id);

  if (!existing) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  // فحص edit_case: صلاحية أساسية أو تفويض فعّال (DENY الصريح يتفوّق داخل الدالة).
  const editPerm = resolveCasePermission(session.user, existing, "edit_case");
  if (!editPerm.allowed) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه القضية" }, { status: 403 });
  }

  const body = await request.json();

  // ===== مسار التعديل الموحّد الموثّق: { changes, reason, reasonNote } =====
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

    const data: Prisma.CaseUpdateInput = {};
    const fieldChanges: FieldChange[] = [];

    for (const key of Object.keys(changesInput)) {
      if (!CASE_EDITABLE_FIELDS.includes(key as (typeof CASE_EDITABLE_FIELDS)[number])) {
        return NextResponse.json({ error: `حقل غير قابل للتعديل: ${key}` }, { status: 400 });
      }
      const check = canEditField("case", key, session.user.role, { status: existing.status });
      if (!check.allowed) {
        return NextResponse.json({ error: check.reason ?? "لا تملك صلاحية تعديل هذا الحقل" }, { status: 403 });
      }

      const raw = changesInput[key];
      const oldVal = (existing as unknown as Record<string, unknown>)[key];
      // تحويل القيمة حسب نوع الحقل.
      if (key === "claimValue") {
        (data as Record<string, unknown>).claimValue = raw === null || raw === "" ? null : Number(raw);
      } else if (key === "caseType") {
        (data as Record<string, unknown>).caseType = raw as CaseType;
      } else if (key === "clientPartyRole") {
        (data as Record<string, unknown>).clientPartyRole = raw as PartyRole;
      } else {
        (data as Record<string, unknown>)[key] = raw === "" ? null : raw;
      }

      fieldChanges.push({
        fieldName: key,
        fieldLabel: EDIT_FIELD_LABELS[key] ?? key,
        oldValue: oldVal,
        newValue: raw,
      });
    }

    if (fieldChanges.length === 0) {
      return NextResponse.json({ error: "لا توجد تغييرات" }, { status: 400 });
    }

    const ip = clientIp(request);
    const updatedCase = await prisma.$transaction(async (tx) => {
      const u = await tx.case.update({
        where: { id },
        data,
        include: { client: true, responsibleLawyer: true, amicableSettlement: true },
      });
      await trackEntityChanges(
        {
          entityType: "case",
          entityId: id,
          changes: fieldChanges,
          changedById: session.user.id,
          reason,
          reasonNote,
          ipAddress: ip,
          viaDelegation: editPerm.viaDelegation,
        },
        tx
      );
      return u;
    });

    // مزامنة الرقم المعروض + إشعار الفريق عند تغيّر رقم المحكمة.
    if ("courtCaseNumber" in changesInput) {
      const displayNumber = await syncCaseDisplayNumber(prisma, id);
      if (displayNumber !== null) updatedCase.displayNumber = displayNumber;
      const trimmed = typeof changesInput.courtCaseNumber === "string" ? changesInput.courtCaseNumber.trim() : "";
      if (trimmed && trimmed !== (existing.courtCaseNumber ?? "")) {
        const teamIds = existing.team.map((m) => m.userId).filter((uid) => uid !== session.user.id);
        await notifyBulk(teamIds, {
          type: "case_number_added",
          priority: "normal",
          title: "أُضيف رقم المحكمة",
          message: `أُضيف/عُدّل رقم المحكمة الرسمي (${trimmed}) للقضية.`,
          actionUrl: `/cases/${id}`,
          resourceType: "Case",
          resourceId: id,
          triggeredById: session.user.id,
        });
      }
    }

    return NextResponse.json(updatedCase);
  }

  // ===== المسار القديم (تحديثات مباشرة: الحالة/الأولوية/رقم المحكمة السريع...) =====
  const { title, status, priority, notes, courtName, courtCaseNumber, claimValue, outcome } = body;

  if (status === "open") {
    const check = await canProceedToCourt(existing.caseType, existing.amicableSettlement);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }
  }

  if (status === "closed" || status === "pending_closure") {
    return NextResponse.json(
      { error: "إغلاق القضية يتم فقط عبر نظام طلب الإغلاق والاعتماد" },
      { status: 400 }
    );
  }
  const hasDirectFieldUpdate =
    title !== undefined ||
    status !== undefined ||
    priority !== undefined ||
    notes !== undefined ||
    courtName !== undefined ||
    courtCaseNumber !== undefined ||
    claimValue !== undefined ||
    outcome !== undefined;

  const updated = await prisma.case.update({
    where: { id },
    data: hasDirectFieldUpdate
      ? {
          title,
          status,
          priority,
          notes,
          courtName,
          courtCaseNumber,
          claimValue: claimValue !== undefined ? Number(claimValue) : undefined,
          outcome,
          closedDate: status === "closed" || status === "archived" ? new Date() : undefined,
        }
      : {},
    include: { client: true, responsibleLawyer: true, amicableSettlement: true },
  });

  // إعادة حساب الرقم المعروض عند تغيّر رقم المحكمة (يتحوّل الرقم للرسمي, أو يعود
  // للتسوية/الداخلي إن أُزيل).
  if (courtCaseNumber !== undefined) {
    const displayNumber = await syncCaseDisplayNumber(prisma, id);
    if (displayNumber !== null) updated.displayNumber = displayNumber;

    // إشعار فريق القضية عند إضافة رقم محكمة جديد (لم يكن موجودًا من قبل).
    const trimmed = typeof courtCaseNumber === "string" ? courtCaseNumber.trim() : "";
    if (trimmed && trimmed !== (existing.courtCaseNumber ?? "")) {
      const teamIds = existing.team.map((m) => m.userId).filter((uid) => uid !== session.user.id);
      await notifyBulk(teamIds, {
        type: "case_number_added",
        priority: "normal",
        title: "أُضيف رقم المحكمة",
        message: `أُضيف رقم المحكمة الرسمي (${trimmed}) للقضية.`,
        actionUrl: `/cases/${id}`,
        resourceType: "Case",
        resourceId: id,
        triggeredById: session.user.id,
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "update",
      resourceType: "Case",
      resourceId: id,
      viaDelegation: editPerm.viaDelegation,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isManagement(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية أرشفة القضايا" }, { status: 403 });
  }

  const { id } = await params;

  const archived = await prisma.case.update({
    where: { id },
    data: { status: "archived", closedDate: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "delete",
      resourceType: "Case",
      resourceId: id,
    },
  });

  return NextResponse.json(archived);
}
