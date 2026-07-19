import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma, ServicePriority, ServiceStatus, ServiceType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateService, generateServiceNumber, serviceVisibilityWhere } from "@/lib/services";

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
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const assignedToId = typeof body.assignedToId === "string" ? body.assignedToId : "";
  const priority = (body.priority as ServicePriority) || "normal";

  if (!title) return NextResponse.json({ error: "عنوان الخدمة مطلوب" }, { status: 400 });
  if (!serviceType || !TYPES.includes(serviceType)) return NextResponse.json({ error: "نوع الخدمة مطلوب" }, { status: 400 });
  if (!clientId) return NextResponse.json({ error: "العميل مطلوب" }, { status: 400 });
  if (!assignedToId) return NextResponse.json({ error: "المسؤول عن الخدمة مطلوب" }, { status: 400 });
  if (!PRIORITIES.includes(priority)) return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
  const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, isActive: true } });
  if (!assignee || !assignee.isActive) return NextResponse.json({ error: "المسؤول غير صالح" }, { status: 400 });

  let dueDate: Date | null = null;
  if (body.dueDate) {
    const d = new Date(body.dueDate);
    if (!Number.isNaN(d.getTime())) dueDate = d;
  }

  const created = await prisma.$transaction(async (tx) => {
    const serviceNumber = await generateServiceNumber(tx);
    return tx.legalService.create({
      data: {
        serviceNumber,
        title,
        serviceType,
        description: description || "—",
        clientId,
        assignedToId,
        priority,
        fee: body.fee !== undefined && body.fee !== null && body.fee !== "" ? Number(body.fee) : null,
        dueDate,
        createdById: session.user.id,
      },
    });
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "LegalService", resourceId: created.id },
  });

  return NextResponse.json(created, { status: 201 });
}
