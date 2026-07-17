import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateCase } from "@/lib/rbac";
import { buildCasesWhere, CASES_PAGE_SIZE } from "@/lib/case-filters";
import { computeDeadlineDate, getAmicableSettlementPlatform } from "@/lib/caseFlow";
import { OPPOSING_ROLE, PARTY_ROLE_LABELS_AR } from "@/lib/parties";
import {
  isValidAgencyNumber,
  isValidNationalIdOrCr,
  isValidSaudiPhone,
  normalizeSaudiPhone,
} from "@/lib/validators";
import {
  checkAgencyDuplicate,
  checkIdentityDuplicate,
  checkPhoneDuplicate,
  duplicatePayload,
} from "@/lib/duplicateCheck";
import type { CaseType, PartyRole } from "@prisma/client";

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

  // تحقق من الأرقام: هوية/سجل العميل الجديد + جواله + رقم الوكالة.
  if (newClient) {
    const id = newClient.nationalIdOrCr?.trim();
    if (id && !isValidNationalIdOrCr(id, newClient.type)) {
      return NextResponse.json(
        {
          error:
            newClient.type === "individual"
              ? "رقم الهوية/الإقامة غير صحيح"
              : "رقم السجل التجاري غير صحيح (10 أرقام)",
        },
        { status: 400 }
      );
    }
    const phone = newClient.phone?.trim();
    if (phone && !isValidSaudiPhone(phone)) {
      return NextResponse.json({ error: "رقم الجوال غير صحيح (مثال: 05XXXXXXXX)" }, { status: 400 });
    }
  }
  if (agency?.agencyNumber && !isValidAgencyNumber(agency.agencyNumber.trim())) {
    return NextResponse.json({ error: "رقم الوكالة غير صحيح (6-15 رقمًا)" }, { status: 400 });
  }

  // توحيد جوال العميل الجديد + فحص التكرار (جوال/هوية/وكالة) قبل الإنشاء.
  const force = body.force === true;
  if (newClient?.phone) {
    newClient.phone = normalizeSaudiPhone(newClient.phone.trim());
  }
  if (!force) {
    if (newClient?.phone) {
      const dup = await checkPhoneDuplicate(newClient.phone);
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
    if (newClient?.nationalIdOrCr?.trim()) {
      const dup = await checkIdentityDuplicate(newClient.nationalIdOrCr.trim());
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
    if (agency?.agencyNumber?.trim()) {
      const dup = await checkAgencyDuplicate(agency.agencyNumber.trim());
      if (dup.hasDuplicate) return NextResponse.json(duplicatePayload(dup), { status: 409 });
    }
  }

  const clientPartyRole = body.clientPartyRole as PartyRole | undefined;
  if (!clientPartyRole || !(clientPartyRole in PARTY_ROLE_LABELS_AR)) {
    return NextResponse.json({ error: "صفة موكّلنا في الدعوى مطلوبة" }, { status: 400 });
  }

  type OpposingPartyPayload = {
    name?: string;
    role?: PartyRole;
    identityNumber?: string | null;
    opposingCounsel?: string | null;
  };
  const opposingParties = (Array.isArray(body.opposingParties)
    ? body.opposingParties
    : []) as OpposingPartyPayload[];

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

      // نأخذ أكبر رقم تسلسلي مستخدم لهذه السنة ونزيده — يتحمّل الفجوات في الترقيم.
      const year = new Date().getFullYear();
      const lastCase = await tx.case.findFirst({
        where: { internalNumber: { startsWith: `MZN-${year}-` } },
        orderBy: { internalNumber: "desc" },
        select: { internalNumber: true },
      });
      const lastSeq = lastCase ? parseInt(lastCase.internalNumber.split("-")[2] ?? "0", 10) : 0;
      const internalNumber = `MZN-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

      const caseType = body.caseType as CaseType;
      const platform = getAmicableSettlementPlatform(caseType);
      const firstStage = platform
        ? await tx.caseFlowStage.findFirst({ where: { caseType, order: 1, active: true } })
        : null;

      // طرف موكّلنا (isOurClient) + الأطراف المقابلة.
      const ourClient = await tx.client.findUnique({ where: { id: clientId } });
      const ourPartyName = ourClient?.fullName ?? newClient?.fullName ?? "موكّلنا";
      const partiesCreate = [
        {
          role: clientPartyRole,
          name: ourPartyName,
          isOurClient: true,
          linkedClientId: clientId,
        },
        ...opposingParties
          .filter((p) => p.name && p.name.trim())
          .map((p) => ({
            role: p.role ?? OPPOSING_ROLE[clientPartyRole],
            name: p.name!.trim(),
            identityNumber: p.identityNumber?.trim() || null,
            opposingCounsel: p.opposingCounsel?.trim() || null,
            isOurClient: false,
          })),
      ];

      return tx.case.create({
        data: {
          internalNumber,
          // عند الإنشاء لا يوجد رقم محكمة ولا رقم تسوية بعد، فالرقم المعروض = الداخلي.
          displayNumber: internalNumber,
          title: body.title,
          caseType,
          courtName: body.courtName || null,
          claimValue: body.claimValue ? Number(body.claimValue) : null,
          clientId,
          responsibleLawyerId: body.responsibleLawyerId,
          priority: body.priority ?? "normal",
          conflictCheckConfirmed: true,
          clientPartyRole,
          notes: body.notes || null,
          parties: { create: partiesCreate },
          team: {
            create: [{ userId: body.responsibleLawyerId, roleInCase: "lawyer" }],
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
