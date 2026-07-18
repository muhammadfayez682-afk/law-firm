import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { AgencyType, CaseStatus, CaseType, ClientType, PartyRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canActivateIntake } from "@/lib/intake";
import { computeDeadlineDate, getAmicableSettlementPlatform } from "@/lib/caseFlow";
import { OPPOSING_ROLE, PARTY_ROLE_LABELS_AR } from "@/lib/parties";

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
  const clientPartyRole = (body.clientPartyRole as PartyRole) || "plaintiff";
  const caseType = (body.caseType as CaseType) || intake.proposedType || "other";
  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    intake.disputeSummary.slice(0, 60);

  // الوكالة اختيارية عند التفعيل: إن وُجد رقم + تاريخ إصدار تُنشأ ويُبدأ العمل كاملًا،
  // وإلا تدخل القضية حالة "قيد إصدار الوكالة" (pending_agency) مع متابعة لاحقة.
  const agencyNumber = typeof body.agencyNumber === "string" ? body.agencyNumber.trim() : "";
  const agencyIssueDate = body.agencyIssueDate ? new Date(body.agencyIssueDate) : null;
  const hasAgency = Boolean(agencyNumber && agencyIssueDate && !Number.isNaN(agencyIssueDate.getTime()));
  const caseStatus: CaseStatus = hasAgency ? "in_progress" : "pending_agency";
  const agencyExpectedDate = body.agencyExpectedDate ? new Date(body.agencyExpectedDate) : null;

  try {
    const created = await prisma.$transaction(async (tx) => {
      // 1. العميل: ربط بموجود عبر الهوية/السجل أو إنشاء جديد.
      let clientId: string | null = null;
      if (intake.clientIdNumber) {
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
          responsibleLawyerId,
          conflictCheckConfirmed: true,
          clientPartyRole,
          notes: `مُنشأة من طلب الاستلام ${intake.requestNumber}.`,
          team: { create: [{ userId: responsibleLawyerId, roleInCase: "lawyer" }] },
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
