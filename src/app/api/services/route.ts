import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma, ServicePriority, ServiceStatus, ServiceType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildServiceTeamRows, canCreateService, generateServiceNumber, serviceVisibilityWhere } from "@/lib/services";

const TYPES: ServiceType[] = ["legal_consultation", "company_formation", "documentation", "execution_request", "contract_drafting", "other"];
const STATUSES: ServiceStatus[] = ["new", "in_progress", "pending_client", "under_review", "completed", "cancelled"];
const PRIORITIES: ServicePriority[] = ["normal", "high", "urgent"];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const serviceType = searchParams.get("serviceType");
  const assignedToId = searchParams.get("assignedToId");

  const where: Prisma.LegalServiceWhereInput = {
    ...serviceVisibilityWhere(session.user),
    ...(status && STATUSES.includes(status as ServiceStatus) ? { status: status as ServiceStatus } : {}),
    ...(serviceType && TYPES.includes(serviceType as ServiceType) ? { serviceType: serviceType as ServiceType } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { serviceNumber: { contains: q, mode: "insensitive" } },
            { client: { fullName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const services = await prisma.legalService.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { fullName: true } }, assignedTo: { select: { fullName: true } } },
  });

  return NextResponse.json(services);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!canCreateService(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية إنشاء خدمة" }, { status: 403 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const serviceType = body.serviceType as ServiceType;
  // العميل اختياري الآن.
  const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;
  const description = typeof body.description === "string" ? body.description.trim() : "";
  // المحامي الرئيسي (lead) — مع دعم assignedToId القديم للتوافق.
  const leadLawyerId =
    (typeof body.leadLawyerId === "string" && body.leadLawyerId) ||
    (typeof body.assignedToId === "string" ? body.assignedToId : "");
  const coLawyerIds: string[] = Array.isArray(body.coLawyerIds)
    ? body.coLawyerIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const priority = (body.priority as ServicePriority) || "normal";

  if (!title) return NextResponse.json({ error: "عنوان الدراسة مطلوب" }, { status: 400 });
  if (!serviceType || !TYPES.includes(serviceType)) return NextResponse.json({ error: "نوع الدراسة مطلوب" }, { status: 400 });
  if (!leadLawyerId) return NextResponse.json({ error: "المحامي الرئيسي مطلوب" }, { status: 400 });
  if (!PRIORITIES.includes(priority)) return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
  }
  const lead = await prisma.user.findUnique({ where: { id: leadLawyerId }, select: { id: true, isActive: true } });
  if (!lead || !lead.isActive) return NextResponse.json({ error: "المحامي الرئيسي غير صالح" }, { status: 400 });

  // تصفية المشاركين: مستخدمون نشطون فقط (وسيُستبعد الرئيسي داخل buildServiceTeamRows).
  const validCoIds =
    coLawyerIds.length > 0
      ? (await prisma.user.findMany({ where: { id: { in: coLawyerIds }, isActive: true }, select: { id: true } })).map((u) => u.id)
      : [];
  const teamRows = buildServiceTeamRows(leadLawyerId, validCoIds);

  let dueDate: Date | null = null;
  if (body.dueDate) {
    const d = new Date(body.dueDate);
    if (!Number.isNaN(d.getTime())) dueDate = d;
  }

  const created = await prisma.$transaction(async (tx) => {
    const serviceNumber = await generateServiceNumber(tx);
    const service = await tx.legalService.create({
      data: {
        serviceNumber,
        title,
        serviceType,
        description: description || "—",
        clientId,
        assignedToId: leadLawyerId, // المحامي الرئيسي مُزامَن مع assignedToId للتوافق.
        priority,
        fee: body.fee !== undefined && body.fee !== null && body.fee !== "" ? Number(body.fee) : null,
        dueDate,
        createdById: session.user.id,
      },
    });
    await tx.serviceTeamMember.createMany({
      data: teamRows.map((r) => ({ serviceId: service.id, userId: r.userId, roleInService: r.roleInService })),
    });
    return service;
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "LegalService", resourceId: created.id },
  });

  return NextResponse.json(created, { status: 201 });
}
