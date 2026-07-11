import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/rbac";
import {
  CASE_ACTIVE_STATUS_AFTER_REJECTION,
  canRequestCaseClosure,
  canTransitionToPendingClosure,
  validateClosureRequestInput,
} from "@/lib/caseClosure";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!caseData) {
    return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  }

  if (!canRequestCaseClosure(session.user.id, caseData)) {
    return NextResponse.json(
      { error: "لا تملك صلاحية طلب إغلاق هذه القضية — يجب أن تكون المحامي المسؤول أو ضمن فريق القضية" },
      { status: 403 }
    );
  }

  if (!canTransitionToPendingClosure(caseData.status)) {
    return NextResponse.json(
      { error: "لا يمكن طلب إغلاق هذه القضية في حالتها الحالية" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const validationError = validateClosureRequestInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const [closureRequest] = await prisma.$transaction([
    prisma.caseClosureRequest.upsert({
      where: { caseId: id },
      update: {
        outcome: body.outcome,
        closureReason: body.closureReason,
        closureNotes: body.closureNotes.trim(),
        requestedById: session.user.id,
        requestedAt: new Date(),
        status: "pending_approval",
        approvedById: null,
        approvedAt: null,
        rejectionNote: null,
      },
      create: {
        caseId: id,
        outcome: body.outcome,
        closureReason: body.closureReason,
        closureNotes: body.closureNotes.trim(),
        requestedById: session.user.id,
      },
    }),
    prisma.case.update({ where: { id }, data: { status: "pending_closure" } }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "create",
        resourceType: "CaseClosureRequest",
        resourceId: id,
      },
    }),
  ]);

  return NextResponse.json(closureRequest, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "اعتماد أو رفض إغلاق القضية صلاحية حصرية لمسؤول النظام" }, { status: 403 });
  }

  const { id } = await params;

  const closureRequest = await prisma.caseClosureRequest.findUnique({ where: { caseId: id } });
  if (!closureRequest || closureRequest.status !== "pending_approval") {
    return NextResponse.json({ error: "لا يوجد طلب إغلاق قيد الانتظار لهذه القضية" }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
  }

  if (action === "reject" && (typeof body.rejectionNote !== "string" || !body.rejectionNote.trim())) {
    return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 });
  }

  const now = new Date();

  const [updatedRequest, updatedCase] = await prisma.$transaction([
    prisma.caseClosureRequest.update({
      where: { caseId: id },
      data:
        action === "approve"
          ? { status: "approved", approvedById: session.user.id, approvedAt: now }
          : {
              status: "rejected",
              approvedById: session.user.id,
              approvedAt: now,
              rejectionNote: body.rejectionNote.trim(),
            },
    }),
    prisma.case.update({
      where: { id },
      data:
        action === "approve"
          ? { status: "closed", closedDate: now, outcome: closureRequest.outcome }
          : { status: CASE_ACTIVE_STATUS_AFTER_REJECTION },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "update",
        resourceType: "CaseClosureRequest",
        resourceId: id,
      },
    }),
  ]);

  return NextResponse.json({ closureRequest: updatedRequest, case: updatedCase });
}
