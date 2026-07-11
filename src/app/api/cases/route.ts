import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateCase } from "@/lib/rbac";
import { buildCasesWhere, CASES_PAGE_SIZE } from "@/lib/case-filters";
import { computeDeadlineDate, getAmicableSettlementPlatform } from "@/lib/caseFlow";
import type { CaseType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const where = buildCasesWhere(session.user, {
    q: searchParams.get("q")?.trim(),
    status: searchParams.get("status"),
    caseType: searchParams.get("caseType"),
    lawyerId: searchParams.get("lawyerId"),
  });

  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * CASES_PAGE_SIZE,
      take: CASES_PAGE_SIZE,
      include: { client: true, responsibleLawyer: true },
    }),
    prisma.case.count({ where }),
  ]);

  return NextResponse.json({
    cases,
    total,
    page,
    pageSize: CASES_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / CASES_PAGE_SIZE)),
  });
}

type NewClientPayload = {
  type: "individual" | "company";
  fullName: string;
  nationalIdOrCr?: string | null;
  nationality?: string | null;
  representativeName?: string | null;
  phone?: string | null;
  email?: string | null;
};

type AgencyPayload = {
  agencyNumber: string;
  agencyType: "general" | "special";
  scopeText: string;
  issueDate: string;
  expiryDate: string;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canCreateCase(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية إنشاء قضية جديدة" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.title || !body.caseType || !body.responsibleLawyerId) {
    return NextResponse.json({ error: "الحقول المطلوبة ناقصة" }, { status: 400 });
  }

  if (!body.clientId && !body.newClient) {
    return NextResponse.json({ error: "بيانات العميل مطلوبة" }, { status: 400 });
  }

  if (!body.conflictCheckConfirmed) {
    return NextResponse.json(
      { error: "إقرار التحقق من تعارض المصالح إلزامي" },
      { status: 400 }
    );
  }

  const newClient = body.newClient as NewClientPayload | undefined;
  const agency = body.agency as AgencyPayload | undefined;

  if (newClient && !newClient.fullName) {
    return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      let clientId: string = body.clientId;

      if (newClient) {
        const client = await tx.client.create({
          data: {
            type: newClient.type,
            fullName: newClient.fullName,
            nationalIdOrCr: newClient.nationalIdOrCr || null,
            nationality: newClient.nationality || null,
            representativeName: newClient.representativeName || null,
            phone: newClient.phone || null,
            email: newClient.email || null,
            status: "active",
          },
        });
        clientId = client.id;
      }

      if (agency?.agencyNumber) {
        await tx.agency.create({
          data: {
            clientId,
            agencyNumber: agency.agencyNumber,
            agencyType: agency.agencyType,
            scopeText: agency.scopeText,
            issueDate: new Date(agency.issueDate),
            expiryDate: new Date(agency.expiryDate),
          },
        });
      }

      const year = new Date().getFullYear();
      const casesThisYear = await tx.case.count({
        where: { internalNumber: { startsWith: `MZN-${year}-` } },
      });
      const internalNumber = `MZN-${year}-${String(casesThisYear + 1).padStart(4, "0")}`;

      const caseType = body.caseType as CaseType;
      const platform = getAmicableSettlementPlatform(caseType);
      const firstStage = platform
        ? await tx.caseFlowStage.findFirst({ where: { caseType, order: 1, active: true } })
        : null;

      return tx.case.create({
        data: {
          internalNumber,
          title: body.title,
          caseType,
          courtName: body.courtName || null,
          claimValue: body.claimValue ? Number(body.claimValue) : null,
          clientId,
          responsibleLawyerId: body.responsibleLawyerId,
          priority: body.priority ?? "normal",
          conflictCheckConfirmed: true,
          notes: body.notes || null,
          team: {
            create: [{ userId: body.responsibleLawyerId, roleInCase: "lead" }],
          },
          ...(platform
            ? {
                amicableSettlement: {
                  create: {
                    platform,
                    isMandatory: firstStage?.isMandatory ?? false,
                    deadlineDate: computeDeadlineDate(caseType),
                  },
                },
              }
            : {}),
        },
        include: { client: true, responsibleLawyer: true },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "create",
        resourceType: "Case",
        resourceId: created.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "تعذّر إنشاء القضية" }, { status: 500 });
  }
}
