import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { AgencyType, CaseStatus, CaseType, ClientType, PartyRole, ServiceType } from "@prisma/client";
import { generateServiceNumber } from "@/lib/services";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canActivateIntake } from "@/lib/intake";
import { computeDeadlineDate, getAmicableSettlementPlatform } from "@/lib/caseFlow";
import { OPPOSING_ROLE, PARTY_ROLE_LABELS_AR } from "@/lib/parties";
import {
  buildTeamMembers,
  TeamValidationError,
  TEAM_ROLE_LABELS_AR,
  type TeamInput,
  type TeamMemberSpec,
} from "@/lib/caseTeam";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** تفعيل القضية من طلب استلام مقبول — مسؤول النظام فقط. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canActivateIntake(session.user.role)) {
    return NextResponse.json({ error: "تفعيل القضية متاح لمسؤول النظام أو المشرف" }, { status: 403 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (intake.caseId) {
    return NextResponse.json({ error: "تم تفعيل القضية لهذا الطلب مسبقًا" }, { status: 400 });
  }
  if (intake.status !== "fee_agreement_pending") {
    return NextResponse.json(
      { error: "لا يمكن تفعيل القضية إلا بعد قبول الطلب وتوقيع عقد الأتعاب" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const responsibleLawyerId: string = body.responsibleLawyerId || session.user.id;
  const clientType = (body.clientType as ClientType) || "individual";

  // ===== طلب خدمة: يُنشأ LegalService بدل Case =====
  if (intake.requestKind === "service") {
    const serviceTitle =
      (typeof body.title === "string" && body.title.trim()) || intake.disputeSummary.slice(0, 60);
    const serviceType = (body.serviceType as ServiceType) || intake.proposedServiceType || "other";

    try {
      const service = await prisma.$transaction(async (tx) => {
        // العميل: الموجود المرتبط، أو ربط بالهوية، أو إنشاء جديد.
        let clientId: string | null = intake.existingClientId;
        if (!clientId && intake.clientIdNumber) {
          const existing = await tx.client.findUnique({ where: { nationalIdOrCr: intake.clientIdNumber } });
          if (existing) clientId = existing.id;
        }
        if (!clientId) {
          const client = await tx.client.create({
            data: {
              type: clientType,
              fullName: intake.clientName,
              nationalIdOrCr: intake.clientIdNumber || null,
              phone: intake.clientPhone,
              email: intake.clientEmail || null,
              status: "active",
            },
          });
          clientId = client.id;
        }

        const serviceNumber = await generateServiceNumber(tx);
        const created = await tx.legalService.create({
          data: {
            serviceNumber,
            title: serviceTitle,
            serviceType,
            description: intake.disputeSummary,
            clientId,
            assignedToId: responsibleLawyerId,
            createdById: session.user.id,
            fee: body.fee !== undefined && body.fee !== null && body.fee !== "" ? Number(body.fee) : null,
          },
        });

        // نقل مستندات الاستلام إلى مستندات الخدمة.
        for (const doc of intake.documents) {
          await tx.serviceDocument.create({
            data: { serviceId: created.id, uploadedById: doc.uploadedById, title: doc.title, storagePath: doc.storagePath },
          });
        }

        await tx.intakeRequest.update({
          where: { id },
          data: { status: "accepted", feeAgreementSignedAt: intake.feeAgreementSignedAt ?? new Date() },
        });

        return created;
      });

      await prisma.auditLog.create({
        data: { userId: session.user.id, action: "create", resourceType: "LegalService", resourceId: service.id },
      });

      return NextResponse.json(
        { kind: "service", serviceId: service.id, serviceNumber: service.serviceNumber },
        { status: 201 }
      );
    } catch {
      return NextResponse.json({ error: "تعذّر تفعيل الخدمة" }, { status: 500 });
    }
  }

  const clientPartyRole = (body.clientPartyRole as PartyRole) || "plaintiff";
  const caseType = (body.caseType as CaseType) || intake.proposedType || "other";
  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    intake.disputeSummary.slice(0, 60);

  // ===== تشكيل فريق القضية =====
  // مدخلات الفريق الكاملة، مع سقوط احتياطي للتوافق (responsibleLawyerId → المحامي الرئيسي).
  const teamInput: TeamInput = body.team
    ? {
        supervisorId: body.team.supervisorId ?? null,
        leadLawyerId: body.team.leadLawyerId ?? responsibleLawyerId,
        coLawyerIds: Array.isArray(body.team.coLawyerIds) ? body.team.coLawyerIds : [],
        researcherIds: Array.isArray(body.team.researcherIds) ? body.team.researcherIds : [],
      }
    : { leadLawyerId: responsibleLawyerId };

  let teamMembers: TeamMemberSpec[];
  try {
    teamMembers = buildTeamMembers(teamInput);
  } catch (e) {
    const msg = e instanceof TeamValidationError ? e.message : "تشكيل الفريق غير صالح";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const leadLawyerId = teamInput.leadLawyerId;

  // الوكالة اختيارية عند التفعيل: إن وُجد رقم + تاريخ إصدار تُنشأ ويُبدأ العمل كاملًا،
  // وإلا تدخل القضية حالة "قيد إصدار الوكالة" (pending_agency) مع متابعة لاحقة.
  const agencyNumber = typeof body.agencyNumber === "string" ? body.agencyNumber.trim() : "";
  const agencyIssueDate = body.agencyIssueDate ? new Date(body.agencyIssueDate) : null;
  const hasAgency = Boolean(agencyNumber && agencyIssueDate && !Number.isNaN(agencyIssueDate.getTime()));
  const caseStatus: CaseStatus = hasAgency ? "in_progress" : "pending_agency";
  const agencyExpectedDate = body.agencyExpectedDate ? new Date(body.agencyExpectedDate) : null;

  try {
    const created = await prisma.$transaction(async (tx) => {
      // 1. العميل: العميل الموجود المرتبط بالطلب، أو ربط بالهوية/السجل، أو إنشاء جديد.
      let clientId: string | null = intake.existingClientId;
      if (!clientId && intake.clientIdNumber) {
        const existing = await tx.client.findUnique({
          where: { nationalIdOrCr: intake.clientIdNumber },
        });
        if (existing) clientId = existing.id;
      }
      if (!clientId) {
        const client = await tx.client.create({
          data: {
            type: clientType,
            fullName: intake.clientName,
            nationalIdOrCr: intake.clientIdNumber || null,
            phone: intake.clientPhone,
            email: intake.clientEmail || null,
            status: "active",
          },
        });
        clientId = client.id;
      }

      // 2. رقم القضية الداخلي (max-based).
      const year = new Date().getFullYear();
      const lastCase = await tx.case.findFirst({
        where: { internalNumber: { startsWith: `MZN-${year}-` } },
        orderBy: { internalNumber: "desc" },
        select: { internalNumber: true },
      });
      const lastSeq = lastCase ? parseInt(lastCase.internalNumber.split("-")[2] ?? "0", 10) : 0;
      const internalNumber = `MZN-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

      // 3. مسار التسوية إن انطبق.
      const platform = getAmicableSettlementPlatform(caseType);
      const firstStage = platform
        ? await tx.caseFlowStage.findFirst({ where: { caseType, order: 1, active: true } })
        : null;

      // 4. القضية + الفريق (المحامي المسؤول) + الأطراف.
      const newCase = await tx.case.create({
        data: {
          internalNumber,
          // عند التفعيل لا يوجد رقم محكمة ولا رقم تسوية بعد، فالرقم المعروض = الداخلي.
          displayNumber: internalNumber,
          status: caseStatus,
          title,
          caseType,
          clientId,
          // المحامي الرئيسي يُزامَن مع responsibleLawyerId للتوافق مع بقية النظام.
          responsibleLawyerId: leadLawyerId,
          createdById: session.user.id, // مفعّل القضية (أساس manage_timeline)
          conflictCheckConfirmed: true,
          clientPartyRole,
          notes: `مُنشأة من طلب الاستلام ${intake.requestNumber}.`,
          // القالب المبدئي للتسلسل الزمني (4 أحداث template).
          timeline: {
            create: [
              { sequence: 1, title: "الدراسة الأولية (بعد اعتمادها)", source: "template", createdById: session.user.id },
              { sequence: 2, title: "الإجراء الأول", source: "template", createdById: session.user.id },
              { sequence: 3, title: "الإجراء الثاني", source: "template", createdById: session.user.id },
              { sequence: 4, title: "الإجراء الثالث", source: "template", createdById: session.user.id },
            ],
          },
          team: { create: teamMembers.map((m) => ({ userId: m.userId, roleInCase: m.roleInCase })) },
          parties: {
            create: [
              {
                role: clientPartyRole,
                name: intake.clientName,
                identityNumber: intake.clientIdNumber || null,
                phone: intake.clientPhone,
                isOurClient: true,
                linkedClientId: clientId,
              },
              ...(intake.opposingParty
                ? [
                    {
                      role: OPPOSING_ROLE[clientPartyRole],
                      name: intake.opposingParty,
                      isOurClient: false,
                    },
                  ]
                : []),
            ],
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
      });

      // 4.ب. إنشاء الوكالة إن قُدّمت بياناتها عند التفعيل.
      if (hasAgency) {
        const expiry = body.agencyExpiryDate
          ? new Date(body.agencyExpiryDate)
          : new Date(agencyIssueDate!.getFullYear() + 1, agencyIssueDate!.getMonth(), agencyIssueDate!.getDate());
        await tx.agency.create({
          data: {
            clientId,
            agencyNumber,
            agencyType: (body.agencyType as AgencyType) || "general",
            scopeText: typeof body.agencyScope === "string" && body.agencyScope.trim()
              ? body.agencyScope.trim()
              : "غير محدد",
            issueDate: agencyIssueDate!,
            expiryDate: expiry,
          },
        });
      }

      // 5. نقل مستندات الاستلام إلى مستندات القضية.
      for (const doc of intake.documents) {
        await tx.document.create({
          data: {
            caseId: newCase.id,
            uploadedById: doc.uploadedById,
            fileName: doc.title,
            storagePath: doc.storagePath,
            category: "intake",
            visibilityLevel: "case_team",
          },
        });
      }

      // 6. نقل النماذج المعبّأة في مرحلة الاستلام إلى القضية.
      await tx.filledTemplate.updateMany({
        where: { intakeId: intake.id },
        data: { caseId: newCase.id, intakeId: null },
      });

      // 7. ربط الطلب بالقضية وإغلاق مساره.
      await tx.intakeRequest.update({
        where: { id },
        data: {
          status: "accepted",
          caseId: newCase.id,
          feeAgreementSignedAt: intake.feeAgreementSignedAt ?? new Date(),
          ...(agencyExpectedDate && !Number.isNaN(agencyExpectedDate.getTime())
            ? { agencyExpectedDate }
            : {}),
        },
      });

      return newCase;
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "create",
        resourceType: "Case",
        resourceId: created.id,
      },
    });

    // إشعار كل عضو في الفريق بدوره (عدا من فعّل القضية بنفسه).
    for (const m of teamMembers) {
      if (m.userId === session.user.id) continue;
      await notify({
        recipientId: m.userId,
        type: "case_assigned",
        title: "أُسندت إليك قضية جديدة",
        message: `${created.title} — دورك: ${TEAM_ROLE_LABELS_AR[m.roleInCase]}`,
        resourceType: "Case",
        resourceId: created.id,
        actionUrl: `/cases/${created.id}`,
        triggeredById: session.user.id,
      });
    }

    return NextResponse.json(
      {
        caseId: created.id,
        internalNumber: created.internalNumber,
        clientRoleLabel: PARTY_ROLE_LABELS_AR[clientPartyRole],
        status: created.status,
        pendingAgency: !hasAgency,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "تعذّر تفعيل القضية" }, { status: 500 });
  }
}
