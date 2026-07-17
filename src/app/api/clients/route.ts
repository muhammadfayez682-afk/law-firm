import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { CaseStatus, ClientType, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientVisibilityWhere } from "@/lib/rbac";
import { isValidNationalIdOrCr, isValidSaudiPhone, normalizeSaudiPhone } from "@/lib/validators";
import { checkIdentityDuplicate, checkPhoneDuplicate, duplicatePayload } from "@/lib/duplicateCheck";

const CLOSED_STATUSES: CaseStatus[] = ["closed", "archived"];

/** تحقق من صحة الأرقام (الهوية/السجل + الجوال) — يُعيد رسالة خطأ أو null. */
function validateClientNumbers(body: {
  type?: "individual" | "company";
  nationalIdOrCr?: string | null;
  phone?: string | null;
}): string | null {
  const idValue = typeof body.nationalIdOrCr === "string" ? body.nationalIdOrCr.trim() : "";
  if (idValue && body.type && !isValidNationalIdOrCr(idValue, body.type)) {
    return body.type === "individual"
      ? "رقم الهوية/الإقامة غير صحيح (10 أرقام تبدأ بـ1 أو 2 مع رقم تحقق صحيح)"
      : "رقم السجل التجاري غير صحيح (10 أرقام)";
  }
  const phoneValue = typeof body.phone === "string" ? body.phone.trim() : "";
  if (phoneValue && !isValidSaudiPhone(phoneValue)) {
    return "رقم الجوال غير صحيح (مثال: 05XXXXXXXX)";
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  const where: Prisma.ClientWhereInput = {
    ...clientVisibilityWhere(session.user),
    ...(type ? { type: type as ClientType } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { nationalIdOrCr: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      cases: { select: { status: true } },
      _count: { select: { cases: true } },
    },
  });

  const withComputedStatus = clients.map((c) => ({
    ...c,
    isActive: c.cases.some((cs) => !CLOSED_STATUSES.includes(cs.status)),
  }));

  const filtered =
    status === "active"
      ? withComputedStatus.filter((c) => c.isActive)
      : status === "inactive"
        ? withComputedStatus.filter((c) => !c.isActive)
        : withComputedStatus;

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (session.user.role === "accountant") {
    return NextResponse.json({ error: "لا تملك صلاحية إضافة عملاء" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.fullName || !body.type) {
    return NextResponse.json({ error: "الحقول المطلوبة ناقصة" }, { status: 400 });
  }

  const validationError = validateClientNumbers(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const phone = typeof body.phone === "string" && body.phone.trim()
    ? normalizeSaudiPhone(body.phone.trim())
    : null;
  const nationalIdOrCr = typeof body.nationalIdOrCr === "string" && body.nationalIdOrCr.trim()
    ? body.nationalIdOrCr.trim()
    : null;
  const force = body.force === true;

  // فحص التكرار (تحذير قابل للتجاوز بـ force بعد تأكيد المستخدم).
  if (!force) {
    if (phone) {
      const dup = await checkPhoneDuplicate(phone);
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
    if (nationalIdOrCr) {
      const dup = await checkIdentityDuplicate(nationalIdOrCr);
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
  }

  const created = await prisma.client.create({
    data: {
      type: body.type,
      fullName: body.fullName,
      nationalIdOrCr,
      nationality: body.nationality || null,
      representativeName: body.representativeName || null,
      phone,
      email: body.email || null,
      status: body.status ?? "prospect",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Client",
      resourceId: created.id,
    },
  });
  if (force && (phone || nationalIdOrCr)) {
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "update", resourceType: "Client", resourceId: created.id },
    });
  }

  return NextResponse.json(created, { status: 201 });
}
