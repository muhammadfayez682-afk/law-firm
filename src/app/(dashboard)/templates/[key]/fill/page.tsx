import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, caseVisibilityWhere } from "@/lib/rbac";
import { canAccessIntake } from "@/lib/intake";
import { getTemplateDefinition, isIntakeEligibleTemplate, type AutofillKey } from "@/lib/templates/definitions";
import { formatDualDate, formatDualDateTime, getDayNameAr, toHijri, toGregorian } from "@/lib/dateUtils";
import { PARTY_ROLE_LABELS_AR } from "@/lib/parties";
import { TemplateFillForm } from "./TemplateFillForm";

const CASE_TYPE_LABELS_AR: Record<string, string> = {
  general: "عام",
  commercial: "تجارية",
  labor: "عمالية",
  personal_status: "أحوال شخصية",
  criminal: "جزائية",
  administrative: "إداري",
  committee: "لجان",
  arbitration: "تحكيم",
  debt_collection: "تحصيل ديون",
  other: "أخرى",
};

export default async function TemplateFillPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ caseId?: string; sessionId?: string; intakeId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { key } = await params;
  const { caseId, sessionId, intakeId } = await searchParams;

  const definition = getTemplateDefinition(key);
  if (!definition || definition.staticPdfPath) notFound();

  // سياق الاستلام: النموذج مرتبط بطلب استلام بدل قضية (للنماذج غير المرتبطة بقضية).
  const intakeContext = intakeId && isIntakeEligibleTemplate(definition);

  const needsCase = definition.linkedTo === "case" || definition.linkedTo === "case_session";
  const needsCaseOptional = definition.linkedTo === "case_optional" && !intakeContext;
  const needsSession = definition.linkedTo === "case_session";

  let selectedCase: Awaited<ReturnType<typeof loadCase>> | null = null;
  let selectedSession: Awaited<ReturnType<typeof loadSession>> | null = null;
  let availableCases: { id: string; internalNumber: string; title: string }[] = [];
  let availableSessions: { id: string; sessionDate: Date; sessionType: string }[] = [];

  if (needsCase || needsCaseOptional) {
    availableCases = await prisma.case.findMany({
      where: caseVisibilityWhere(session.user),
      orderBy: { createdAt: "desc" },
      select: { id: true, internalNumber: true, title: true },
    });

    if (caseId) {
      selectedCase = await loadCase(caseId);
      if (selectedCase && !canAccessCase(session.user, selectedCase)) {
        selectedCase = null;
      }
    }
  }

  if (needsSession && selectedCase) {
    availableSessions = await prisma.session.findMany({
      where: { caseId: selectedCase.id },
      orderBy: { sessionDate: "desc" },
      select: { id: true, sessionDate: true, sessionType: true },
    });

    if (sessionId) {
      selectedSession = await loadSession(sessionId);
    }
  }

  const now = new Date();
  // تاريخ التقرير = تاريخ الجلسة نفسها (لا تاريخ اليوم) عند وجود سياق جلسة — إصلاح العيب السياقي.
  const reportDate = selectedSession?.sessionDate ?? now;
  const sessionDualDate = selectedSession
    ? `${selectedSession.hijriDate ?? toHijri(selectedSession.sessionDate)}هـ (${toGregorian(selectedSession.sessionDate)}م)`
    : formatDualDate(now);
  const autofillValues: Partial<Record<AutofillKey, string>> = {
    lawyerName: session.user.name ?? "",
    dateHijriGregorian: sessionDualDate,
    weekday: getDayNameAr(reportDate),
  };

  // سياق الاستلام: تحميل الطلب وتعبئة بيانات العميل الأولية.
  let intakeInfo: { id: string; requestNumber: string } | null = null;
  if (intakeContext && intakeId) {
    const intake = await prisma.intakeRequest.findUnique({
      where: { id: intakeId },
      select: {
        id: true,
        requestNumber: true,
        receivedById: true,
        clientName: true,
        clientPhone: true,
        clientIdNumber: true,
      },
    });
    if (intake && canAccessIntake(session.user, intake)) {
      intakeInfo = { id: intake.id, requestNumber: intake.requestNumber };
      autofillValues.clientName = intake.clientName;
      autofillValues.clientPhone = intake.clientPhone ?? "";
      autofillValues.clientNationalId = intake.clientIdNumber ?? "";
    }
  }

  if (selectedCase) {
    autofillValues.clientName = selectedCase.client.fullName;
    autofillValues.clientNationalId = selectedCase.client.nationalIdOrCr ?? "";
    autofillValues.clientPhone = selectedCase.client.phone ?? "";
    autofillValues.agencyNumber = selectedCase.client.agencies[0]?.agencyNumber ?? "";
    autofillValues.caseNumber = selectedCase.internalNumber;
    // الرقم الرسمي المفضّل (المحكمة ← التسوية ← الداخلي) للحقول العامة "رقم القضية".
    autofillValues.primaryCaseNumber = selectedCase.displayNumber ?? selectedCase.internalNumber;
    autofillValues.caseTitle = selectedCase.title;
    autofillValues.courtName = selectedCase.courtName ?? "";
    autofillValues.courtDepartment = selectedCase.department ?? "";
    autofillValues.judgeName = selectedCase.judge ?? "";
    autofillValues.courtCaseNumber = selectedCase.courtCaseNumber ?? "";
    autofillValues.caseTypeLabel = CASE_TYPE_LABELS_AR[selectedCase.caseType] ?? selectedCase.caseType;

    // أطراف الدعوى: المدعي/المدعى عليه وصفة موكّلنا.
    const PLAINTIFF_ROLES = ["plaintiff", "appellant", "petitioner"];
    const plaintiffParty = selectedCase.parties.find((p) => PLAINTIFF_ROLES.includes(p.role));
    const defendantParty = selectedCase.parties.find((p) => !PLAINTIFF_ROLES.includes(p.role));
    autofillValues.plaintiffName = plaintiffParty?.name ?? "";
    autofillValues.defendantName = defendantParty?.name ?? "";
    autofillValues.clientPartyRole = selectedCase.clientPartyRole
      ? PARTY_ROLE_LABELS_AR[selectedCase.clientPartyRole]
      : "";
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-foreground/50">تعبئة نموذج</p>
        <h1 className="font-amiri text-2xl font-bold text-navy">{definition.name}</h1>
      </div>

      <TemplateFillForm
        key={`${selectedCase?.id ?? "none"}-${selectedSession?.id ?? "none"}-${intakeInfo?.id ?? "none"}`}
        definition={definition}
        autofillValues={autofillValues}
        selectedCaseId={selectedCase?.id ?? null}
        selectedSessionId={selectedSession?.id ?? null}
        intakeContext={intakeInfo}
        availableCases={availableCases}
        availableSessions={availableSessions.map((s) => ({
          id: s.id,
          label: `${formatDualDateTime(s.sessionDate)} — ${s.sessionType}`,
        }))}
      />
    </div>
  );
}

function loadCase(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      client: { include: { agencies: true } },
      team: true,
      accessOverrides: true,
      parties: true,
    },
  });
}

function loadSession(id: string) {
  return prisma.session.findUnique({ where: { id } });
}
