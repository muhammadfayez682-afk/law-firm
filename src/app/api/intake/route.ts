import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { CaseType, IntakeKind, IntakeSource, IntakeStatus, Prisma, ServiceType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { intakeVisibilityWhere } from "@/lib/intake";
import { checkConflictOfInterest } from "@/lib/conflictCheck";
import { isValidSaudiPhone, normalizeSaudiPhone, VALIDATION_MESSAGES } from "@/lib/validators";
import { checkIdentityDuplicate, checkPhoneDuplicate, duplicatePayload } from "@/lib/duplicateCheck";
import { notifyBulk } from "@/lib/notifications/send";
import { getUserIdsByRoles } from "@/lib/notifications/recipients";

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
  const clientPhone = typeof body.clientPhone === "string" ? normalizeSaudiPhone(body.clientPhone.trim()) : "";
  const clientIdNumber = typeof body.clientIdNumber === "string" ? body.clientIdNumber.trim() : "";
  const disputeSummary = typeof body.disputeSummary === "string" ? body.disputeSummary.trim() : "";
  const opposingParty = typeof body.opposingParty === "string" ? body.opposingParty.trim() : "";
  const source = body.source as IntakeSource;
  const force = body.force === true;

  // نوع الطلب (قضية/خدمة) + ربط بعميل موجود أو قضية قائمة.
  const requestKind: IntakeKind = body.requestKind === "service" ? "service" : "case";
  const isService = requestKind === "service";
  const existingClientId = typeof body.existingClientId === "string" && body.existingClientId ? body.existingClientId : null;
  const relatedCaseId = typeof body.relatedCaseId === "string" && body.relatedCaseId ? body.relatedCaseId : null;
  const proposedServiceType = isService && body.proposedServiceType ? (body.proposedServiceType as ServiceType) : null;

  if (!clientName) return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
  if (!clientPhone || !isValidSaudiPhone(clientPhone)) {
    return NextResponse.json({ error: VALIDATION_MESSAGES.phone }, { status: 400 });
  }
  if (clientIdNumber && !/^\d{10}$/.test(clientIdNumber)) {
    return NextResponse.json({ error: "رقم الهوية/السجل يجب أن يكون 10 أرقام (يبدأ بـ 1 للهوية أو 2 للإقامة)" }, { status: 400 });
  }
  if (disputeSummary.length < 30) {
    return NextResponse.json(
      { error: isService ? "وصف الخدمة المطلوبة يجب ألا يقل عن 30 حرفًا" : "ملخص النزاع يجب ألا يقل عن 30 حرفًا" },
      { status: 400 }
    );
  }
  // الطرف المقابل مطلوب للقضايا فقط (الخدمات لا خصومة فيها).
  if (!isService && !opposingParty) {
    return NextResponse.json({ error: "الطرف المقابل مطلوب لفحص التعارض" }, { status: 400 });
  }
  if (!source) return NextResponse.json({ error: "مصدر الطلب مطلوب" }, { status: 400 });

  // العميل الموجود: تحقق من وجوده (لا فحص تكرار عندئذٍ — هو نفسه العميل).
  if (existingClientId) {
    const c = await prisma.client.findUnique({ where: { id: existingClientId }, select: { id: true } });
    if (!c) return NextResponse.json({ error: "العميل المحدد غير موجود" }, { status: 404 });
  }

  // فحص تكرار الجوال/الهوية — يُتخطّى عند اختيار عميل موجود صراحةً.
  if (!force && !existingClientId) {
    const phoneDup = await checkPhoneDuplicate(clientPhone);
    if (phoneDup.hasDuplicate) return NextResponse.json(duplicatePayload(phoneDup), { status: 409 });
    if (clientIdNumber) {
      const idDup = await checkIdentityDuplicate(clientIdNumber);
      if (idDup.hasDuplicate) return NextResponse.json(duplicatePayload(idDup), { status: 409 });
    }
  }

  // فحص تعارض المصالح الآلي (للقضايا فقط).
  const conflict = isService
    ? { result: "clear" as const, details: "طلب خدمة — لا خصومة تستدعي فحص تعارض." }
    : await checkConflictOfInterest(opposingParty);

  const created = await prisma.$transaction(async (tx) => {
    const requestNumber = await generateIntakeNumber(tx);
    return tx.intakeRequest.create({
      data: {
        requestNumber,
        clientName,
        clientPhone,
        clientEmail: body.clientEmail?.trim() || null,
        clientIdNumber: clientIdNumber || null,
        disputeSummary,
        opposingParty: opposingParty || null,
        proposedType: isService ? null : (body.proposedType as CaseType) || null,
        requestKind,
        existingClientId,
        relatedCaseId,
        proposedServiceType,
        source,
        referredBy: body.referredBy?.trim() || null,
        receivedById: session.user.id,
        // طلبات الخدمات لا تمرّ بفحص التعارض — تبدأ مباشرة قيد التقييم.
        status: isService ? "under_assessment" : "conflict_check",
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
  if (force) {
    await prisma.intakeNote.create({
      data: { intakeId: created.id, authorId: session.user.id, content: "حُفظ الطلب رغم تحذير تكرار (تأكيد المستخدم)." },
    });
  }

  // إشعارات: طلب استلام جديد لكل مسؤولي النظام (عدا المُنشئ)، وتعارض مؤكد (عاجل).
  const adminIds = (await getUserIdsByRoles(["system_admin"])).filter((id) => id !== session.user.id);
  await notifyBulk(adminIds, {
    type: "intake_new",
    priority: "normal",
    title: "طلب استلام جديد",
    message: `طلب جديد من ${clientName} (${created.requestNumber}).`,
    actionUrl: `/intake/${created.id}`,
    resourceType: "IntakeRequest",
    resourceId: created.id,
    triggeredById: session.user.id,
  });
  if (conflict.result === "confirmed") {
    await notifyBulk(await getUserIdsByRoles(["system_admin"]), {
      type: "intake_conflict_detected",
      priority: "urgent",
      title: "تعارض مصالح مؤكد",
      message: `فحص التعارض في الطلب ${created.requestNumber} أظهر تعارضًا مؤكدًا مع ${opposingParty}.`,
      actionUrl: `/intake/${created.id}`,
      resourceType: "IntakeRequest",
      resourceId: created.id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ ...created, conflict }, { status: 201 });
}
