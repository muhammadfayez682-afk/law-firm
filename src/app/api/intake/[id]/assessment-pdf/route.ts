import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake } from "@/lib/intake";
import { formatCurrency } from "@/lib/formatNumber";
import { formatDualDate } from "@/lib/dateUtils";
import { generateAssessmentPdf } from "@/lib/pdf/assessmentStudy";

type Params = { params: Promise<{ id: string }> };

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

/** تصدير دراسة التقييم PDF — بعد الاعتماد فقط، لمن يملك رؤية الطلب. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({
    where: { id },
    include: {
      assessmentApprovedBy: { select: { fullName: true } },
      documents: { select: { title: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!canAccessIntake(session.user, intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذا الطلب" }, { status: 403 });
  }
  if (!intake.assessmentApprovedAt) {
    return NextResponse.json({ error: "لا يُصدَّر PDF إلا بعد اعتماد التقييم" }, { status: 400 });
  }

  let pdf: Buffer;
  try {
    pdf = await generateAssessmentPdf({
      requestNumber: intake.requestNumber,
      clientName: intake.clientName,
      clientIdNumber: intake.clientIdNumber,
      clientPhone: intake.clientPhone,
      caseTypeLabel: intake.proposedType ? CASE_TYPE_LABELS_AR[intake.proposedType] ?? intake.proposedType : "—",
      opposingParty: intake.opposingParty,
      facts: intake.disputeSummary,
      evidence: intake.evidence,
      documents: intake.documents,
      legalBasis: intake.legalBasis,
      jurisdiction: intake.jurisdiction,
      strengths: intake.strengths,
      weaknesses: intake.weaknesses,
      estimatedDuration: intake.estimatedDuration,
      proposedFee: intake.proposedFee != null ? formatCurrency(Number(intake.proposedFee)) : null,
      finalDirection: intake.finalDirection,
      approverNotes: intake.approverNotes,
      approvedByName: intake.assessmentApprovedBy?.fullName ?? null,
      approvedAtLabel: formatDualDate(intake.assessmentApprovedAt),
    });
  } catch {
    return NextResponse.json({ error: "تعذّر توليد ملف PDF" }, { status: 500 });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "view", resourceType: "IntakeRequest", resourceId: id },
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="assessment-${intake.requestNumber}.pdf"`,
    },
  });
}
