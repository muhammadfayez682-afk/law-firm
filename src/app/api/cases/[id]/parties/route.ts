import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { PartyRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canEditCase } from "@/lib/rbac";
import { PARTY_ROLE_LABELS_AR } from "@/lib/parties";
import { isValidSaudiPhone, normalizeSaudiPhone } from "@/lib/validators";
import { checkIdentityDuplicate, checkPhoneDuplicate, duplicatePayload } from "@/lib/duplicateCheck";

type Params = { params: Promise<{ id: string }> };

/** تحقق صيغة جوال/هوية الطرف — يُعيد رسالة خطأ أو null. */
function partyNumberError(phone?: string, identityNumber?: string): string | null {
  if (phone && !isValidSaudiPhone(phone)) return "رقم جوال الطرف يجب أن يكون 10 أرقام يبدأ بـ 05";
  if (identityNumber && !/^\d{10}$/.test(identityNumber)) return "رقم هوية الطرف يجب أن يكون 10 أرقام";
  return null;
}

async function loadCase(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: { team: true, accessOverrides: true },
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canAccessCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية على هذه القضية" }, { status: 403 });
  }

  const parties = await prisma.caseParty.findMany({
    where: { caseId: id },
    orderBy: [{ isOurClient: "desc" }, { id: "asc" }],
  });
  return NextResponse.json(parties);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canEditCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل أطراف هذه القضية" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role as PartyRole;
  if (!name) return NextResponse.json({ error: "اسم الطرف مطلوب" }, { status: 400 });
  if (!role || !(role in PARTY_ROLE_LABELS_AR)) {
    return NextResponse.json({ error: "صفة الطرف مطلوبة" }, { status: 400 });
  }

  // موكّل واحد فقط لكل قضية: لا يُسمح بإضافة طرف isOurClient آخر.
  const isOurClient = Boolean(body.isOurClient);
  if (isOurClient) {
    const existingOurs = await prisma.caseParty.count({ where: { caseId: id, isOurClient: true } });
    if (existingOurs > 0) {
      return NextResponse.json({ error: "يوجد موكّل مسجّل لهذه القضية بالفعل" }, { status: 400 });
    }
  }

  const phone = body.phone?.trim() ? normalizeSaudiPhone(body.phone.trim()) : "";
  const identityNumber = body.identityNumber?.trim() || "";
  const numberError = partyNumberError(phone, identityNumber);
  if (numberError) return NextResponse.json({ error: numberError }, { status: 400 });

  const force = body.force === true;
  if (!force) {
    if (phone) {
      const dup = await checkPhoneDuplicate(phone);
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
    if (identityNumber) {
      const dup = await checkIdentityDuplicate(identityNumber);
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
  }

  const created = await prisma.caseParty.create({
    data: {
      caseId: id,
      role,
      name,
      identityNumber: identityNumber || null,
      phone: phone || null,
      address: body.address?.trim() || null,
      opposingCounsel: body.opposingCounsel?.trim() || null,
      notes: body.notes?.trim() || null,
      isOurClient,
      linkedClientId: body.linkedClientId || null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Case", resourceId: id },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canEditCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل أطراف هذه القضية" }, { status: 403 });
  }

  const body = await request.json();
  const partyId = body.partyId as string;
  if (!partyId) return NextResponse.json({ error: "معرّف الطرف مطلوب" }, { status: 400 });

  const party = await prisma.caseParty.findFirst({ where: { id: partyId, caseId: id } });
  if (!party) return NextResponse.json({ error: "الطرف غير موجود" }, { status: 404 });

  if (body.role !== undefined && !(body.role in PARTY_ROLE_LABELS_AR)) {
    return NextResponse.json({ error: "صفة غير صالحة" }, { status: 400 });
  }

  const newPhone = body.phone !== undefined && body.phone?.trim()
    ? normalizeSaudiPhone(body.phone.trim())
    : "";
  const newIdentity = body.identityNumber !== undefined ? body.identityNumber?.trim() || "" : "";
  const numberError = partyNumberError(newPhone, newIdentity);
  if (numberError) return NextResponse.json({ error: numberError }, { status: 400 });

  const force = body.force === true;
  if (!force) {
    if (newPhone && newPhone !== party.phone) {
      const dup = await checkPhoneDuplicate(newPhone, { excludePartyId: partyId });
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
    if (newIdentity && newIdentity !== party.identityNumber) {
      const dup = await checkIdentityDuplicate(newIdentity, { excludePartyId: partyId });
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
  }

  const updated = await prisma.caseParty.update({
    where: { id: partyId },
    data: {
      role: body.role ?? undefined,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
      identityNumber: body.identityNumber !== undefined ? body.identityNumber?.trim() || null : undefined,
      phone: body.phone !== undefined ? newPhone || null : undefined,
      address: body.address !== undefined ? body.address?.trim() || null : undefined,
      opposingCounsel:
        body.opposingCounsel !== undefined ? body.opposingCounsel?.trim() || null : undefined,
      notes: body.notes !== undefined ? body.notes?.trim() || null : undefined,
    },
  });

  // إبقاء clientPartyRole متزامنًا مع صفة موكّلنا.
  if (party.isOurClient && body.role) {
    await prisma.case.update({ where: { id }, data: { clientPartyRole: body.role } });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Case", resourceId: id },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const caseData = await loadCase(id);
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (!canEditCase(session.user, caseData)) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل أطراف هذه القضية" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("partyId");
  if (!partyId) return NextResponse.json({ error: "معرّف الطرف مطلوب" }, { status: 400 });

  const party = await prisma.caseParty.findFirst({ where: { id: partyId, caseId: id } });
  if (!party) return NextResponse.json({ error: "الطرف غير موجود" }, { status: 404 });

  // لا يمكن حذف موكّلنا — كل قضية يجب أن تبقى بموكّل واحد.
  if (party.isOurClient) {
    return NextResponse.json({ error: "لا يمكن حذف موكّلنا من القضية" }, { status: 400 });
  }

  await prisma.caseParty.delete({ where: { id: partyId } });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Case", resourceId: id },
  });

  return NextResponse.json({ ok: true });
}
