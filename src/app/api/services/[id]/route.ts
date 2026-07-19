import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma, ServicePriority, ServiceStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessService, canEditService, canManageServiceFee } from "@/lib/services";

type Params = { params: Promise<{ id: string }> };

const STATUSES: ServiceStatus[] = ["new", "in_progress", "pending_client", "under_review", "completed", "cancelled"];
const PRIORITIES: ServicePriority[] = ["normal", "high", "urgent"];

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const service = await prisma.legalService.findUnique({
    where: { id },
    include: {
      client: true,
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
      notes: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      documents: { include: { uploadedBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!service) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
  if (!canAccessService(session.user, service)) {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على هذه الخدمة" }, { status: 403 });
  }
  return NextResponse.json(service);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const service = await prisma.legalService.findUnique({ where: { id } });
  if (!service) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });

  const body = await request.json();
  const editable = canEditService(session.user, service);
  const feeOnly = !editable && canManageServiceFee(session.user.role);
  if (!editable && !feeOnly) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل هذه الخدمة" }, { status: 403 });
  }

  const data: Prisma.LegalServiceUpdateInput = {};

  // المحاسب يعدّل الأتعاب فقط.
  if (body.fee !== undefined && canManageServiceFee(session.user.role)) {
    data.fee = body.fee === null || body.fee === "" ? null : Number(body.fee);
  }

  if (editable) {
    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.description === "string") data.description = body.description.trim();
    if (typeof body.deliverable === "string") data.deliverable = body.deliverable;
    if (typeof body.deliverableNotes === "string") data.deliverableNotes = body.deliverableNotes;
    if (body.priority && PRIORITIES.includes(body.priority)) data.priority = body.priority;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.status && STATUSES.includes(body.status)) {
      data.status = body.status;
      if (body.status === "completed") data.completedAt = new Date();
    }
  }

  const updated = await prisma.legalService.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "LegalService", resourceId: id },
  });

  return NextResponse.json(updated);
}
