import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { CaseType, IntakeSource, IntakeStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { intakeVisibilityWhere } from "@/lib/intake";
import { checkConflictOfInterest } from "@/lib/conflictCheck";
import { isValidSaudiPhone } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const receivedById = searchParams.get("receivedById");

  const where: Prisma.IntakeRequestWhereInput = {
    ...intakeVisibilityWhere(session.user),
    ...(status ? { status: status as IntakeStatus } : {}),
    ...(source ? { source: source as IntakeSource } : {}),
    ...(receivedById ? { receivedById } : {}),
    ...(q
      ? {
          OR: [
            { requestNumber: { contains: q, mode: "insensitive" } },
            { clientName: { contains: q, mode: "insensitive" } },
            { opposingParty: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const intakes = await prisma.intakeRequest.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    include: { receivedBy: { select: { fullName: true } } },
  });

  return NextResponse.json(intakes);
}

async function generateIntakeNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.intakeRequest.findFirst({
    where: { requestNumber: { startsWith: `INT-${year}-` } },
    orderBy: { requestNumber: "desc" },
    select: { requestNumber: true },
  });
  const lastSeq = last ? parseInt(last.requestNumber.split("-")[2] ?? "0", 10) : 0;
  return `INT-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json();
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const clientPhone = typeof body.clientPhone === "string" ? body.clientPhone.trim() : "";
  const disputeSummary = typeof body.disputeSummary === "string" ? body.disputeSummary.trim() : "";
  const opposingParty = typeof body.opposingParty === "string" ? body.opposingParty.trim() : "";
  const source = body.source as IntakeSource;

  if (!clientName) return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
  if (!clientPhone || !isValidSaudiPhone(clientPhone)) {
    return NextResponse.json({ error: "رقم جوال صحيح مطلوب (مثال: 05XXXXXXXX)" }, { status: 400 });
  }
  if (disputeSummary.length < 30) {
    return NextResponse.json({ error: "ملخص النزاع يجب ألا يقل عن 30 حرفًا" }, { status: 400 });
  }
  if (!opposingParty) {
    return NextResponse.json({ error: "الطرف المقابل مطلوب لفحص التعارض" }, { status: 400 });
  }
  if (!source) return NextResponse.json({ error: "مصدر القضية مطلوب" }, { status: 400 });

  // فحص تعارض المصالح الآلي عند الإنشاء.
  const conflict = await checkConflictOfInterest(opposingParty);

  const created = await prisma.$transaction(async (tx) => {
    const requestNumber = await generateIntakeNumber(tx);
    return tx.intakeRequest.create({
      data: {
        requestNumber,
        clientName,
        clientPhone,
        clientEmail: body.clientEmail?.trim() || null,
        clientIdNumber: body.clientIdNumber?.trim() || null,
        disputeSummary,
        opposingParty,
        proposedType: (body.proposedType as CaseType) || null,
        source,
        referredBy: body.referredBy?.trim() || null,
        receivedById: session.user.id,
        status: "conflict_check",
        conflictResult: conflict.result,
        conflictNotes: conflict.details,
        conflictCheckedAt: new Date(),
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "IntakeRequest",
      resourceId: created.id,
    },
  });

  return NextResponse.json({ ...created, conflict }, { status: 201 });
}
