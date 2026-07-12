import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { PartyRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canEditCase } from "@/lib/rbac";
import { PARTY_ROLE_LABELS_AR } from "@/lib/parties";

type Params = { params: Promise<{ id: string }> };

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

  const created = await prisma.caseParty.create({
    data: {
      caseId: id,
      role,
      name,
      identityNumber: body.identityNumber?.trim() || null,
      phone: body.phone?.trim() || null,
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

  const updated = await prisma.caseParty.update({
    where: { id: partyId },
    data: {
      role: body.role ?? undefined,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
      identityNumber: body.identityNumber !== undefined ? body.identityNumber?.trim() || null : undefined,
      phone: body.phone !== undefined ? body.phone?.trim() || null : undefined,
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
