import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import {
  canWriteSessionReport,
  isSessionSummaryFilled,
  findEarliestHeldSessionMissingReport,
  notifySessionReportRequired,
  reportBlockedMessage,
} from "@/lib/sessionReport";

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

const SESSION_TYPE_LABELS_AR: Record<string, string> = {
  negotiation_meeting: "جلسة تسوية ودية",
  hearing: "مرافعة",
  initial_listening: "استماع",
  verdict: "نطق بالحكم",
  arbitration: "تحكيم",
};

const PLAINTIFF_ROLES = ["plaintiff", "appellant", "petitioner"];

function loadSessionWithCase(id: string) {
  return prisma.session.findUnique({
    where: { id },
    include: {
      report: { include: { createdBy: { select: { fullName: true } } } },
      case: {
        include: {
          team: true,
          accessOverrides: true,
          delegations: true,
          responsibleLawyer: { select: { fullName: true } },
          parties: true,
        },
      },
    },
  });
}

/** البيانات التلقائية المعروضة للقراءة أعلى التقرير (من القضية والجلسة). */
function buildContext(s: NonNullable<Awaited<ReturnType<typeof loadSessionWithCase>>>) {
  const c = s.case;
  const plaintiff = c.parties.find((p) => PLAINTIFF_ROLES.includes(p.role))?.name ?? null;
  const defendant = c.parties.find((p) => !PLAINTIFF_ROLES.includes(p.role))?.name ?? null;
  return {
    caseId: c.id,
    caseTitle: c.title,
    caseNumber: c.displayNumber ?? c.internalNumber,
    courtCaseNumber: c.courtCaseNumber,
    courtName: c.courtName,
    department: c.department,
    judge: c.judge,
    caseTypeLabel: CASE_TYPE_LABELS_AR[c.caseType] ?? c.caseType,
    plaintiff,
    defendant,
    responsibleLawyer: c.responsibleLawyer.fullName,
    // ⚠️ تاريخ الجلسة الفعلي من الجلسة نفسها (لا تاريخ اليوم).
    sessionDate: s.sessionDate.toISOString(),
    hijriDate: s.hijriDate,
    sessionTypeLabel: SESSION_TYPE_LABELS_AR[s.sessionType] ?? s.sessionType,
    sessionStatus: s.status,
  };
}

function serializeReport(r: NonNullable<Awaited<ReturnType<typeof loadSessionWithCase>>>["report"]) {
  if (!r) return null;
  return {
    id: r.id,
    sessionSummary: r.sessionSummary,
    courtNotes: r.courtNotes,
    proposedDirection: r.proposedDirection,
    createdByName: r.createdBy.fullName,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const s = await loadSessionWithCase(id);
  if (!s) return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 });
  if (!canAccessCase(session.user, s.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذه الجلسة" }, { status: 403 });
  }

  const canEdit = canWriteSessionReport(session.user, s.case);
  const blocker = await findEarliestHeldSessionMissingReport(prisma, s.caseId, {
    beforeDate: s.sessionDate,
    excludeSessionId: s.id,
  });

  return NextResponse.json({
    report: serializeReport(s.report),
    context: buildContext(s),
    canEdit,
    blocked: blocker ? { hijriDate: blocker.hijriDate, message: reportBlockedMessage(blocker) } : null,
  });
}

/** إنشاء أو تعديل تقرير الجلسة (upsert منطقيًا — POST للإنشاء، PATCH للتعديل). */
async function writeReport(request: NextRequest, id: string, expectExisting: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const s = await loadSessionWithCase(id);
  if (!s) return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 });

  if (!canWriteSessionReport(session.user, s.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية كتابة تقرير هذه الجلسة" }, { status: 403 });
  }

  if (expectExisting && !s.report) {
    return NextResponse.json({ error: "لا يوجد تقرير لتعديله" }, { status: 404 });
  }
  if (!expectExisting && s.report) {
    return NextResponse.json({ error: "يوجد تقرير لهذه الجلسة — استخدم التعديل" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionSummary = typeof body.sessionSummary === "string" ? body.sessionSummary : "";
  if (!isSessionSummaryFilled(sessionSummary)) {
    return NextResponse.json(
      { error: "ملخص الجلسة إلزامي — لا يمكن حفظ التقرير دون ملخص فعلي." },
      { status: 400 }
    );
  }

  // القيد التسلسلي: لا تقرير لجلسة ما دامت جلسة منعقدة أسبق زمنيًا بلا تقرير.
  const blocker = await findEarliestHeldSessionMissingReport(prisma, s.caseId, {
    beforeDate: s.sessionDate,
    excludeSessionId: s.id,
  });
  if (blocker) {
    await notifySessionReportRequired(prisma, s.caseId, blocker, session.user.id);
    return NextResponse.json({ error: reportBlockedMessage(blocker) }, { status: 400 });
  }

  const courtNotes = typeof body.courtNotes === "string" && body.courtNotes.trim() ? body.courtNotes.trim() : null;
  const proposedDirection =
    typeof body.proposedDirection === "string" && body.proposedDirection.trim() ? body.proposedDirection.trim() : null;

  const saved = s.report
    ? await prisma.sessionReport.update({
        where: { sessionId: id },
        data: { sessionSummary: sessionSummary.trim(), courtNotes, proposedDirection },
      })
    : await prisma.sessionReport.create({
        data: { sessionId: id, sessionSummary: sessionSummary.trim(), courtNotes, proposedDirection, createdById: session.user.id },
      });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: s.report ? "update" : "create",
      resourceType: "SessionReport",
      resourceId: saved.id,
    },
  });

  return NextResponse.json({ ok: true, id: saved.id }, { status: s.report ? 200 : 201 });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return writeReport(request, id, false);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return writeReport(request, id, true);
}
