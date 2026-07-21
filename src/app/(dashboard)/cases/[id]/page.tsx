import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canEditCase, isSystemAdmin } from "@/lib/rbac";
import { getAmicableSettlementPlatform, getCaseFlowStages, getFirstStage } from "@/lib/caseFlow";
import { canAuthorMemo, canReviewMemo } from "@/lib/memos";
import { displayTaskStatus, getAssignableUsers } from "@/lib/tasks";
import { canArchiveCase, canRestoreCase, checkDeleteEligibility } from "@/lib/caseArchive";
import { CaseDetailView } from "./CaseDetailView";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      client: true,
      responsibleLawyer: true,
      parties: { include: { linkedClient: true } },
      team: { include: { user: true } },
      accessOverrides: true,
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      sessions: {
        orderBy: { sessionDate: "asc" },
        include: {
          preparationChecklist: {
            orderBy: { createdAt: "asc" },
            include: { completedBy: { select: { fullName: true } } },
          },
        },
      },
      amicableSettlement: true,
      closureRequest: { include: { requestedBy: true, approvedBy: true } },
      reopenLogs: { include: { reopenedBy: true }, orderBy: { reopenedAt: "desc" } },
      memos: {
        orderBy: { updatedAt: "desc" },
        include: { authoredBy: { select: { fullName: true } } },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: { assignedTo: { select: { fullName: true } } },
      },
      invoices: { select: { status: true } },
    },
  });

  if (!caseData) notFound();
  if (!canAccessCase(session.user, caseData)) notFound();
  // القضايا المحذوفة (حذف ناعم) لا تُعرض إلا لمسؤول النظام.
  if (caseData.deletedAt && !isSystemAdmin(session.user.role)) notFound();

  // حالة الأرشفة/الحذف + الأهلية.
  const heldSessionsCount = caseData.sessions.filter((s) => s.status === "held").length;
  const paidInvoicesCount = caseData.invoices.filter((i) => i.status === "paid").length;
  const archiveInfo = {
    isArchived: caseData.status === "archived",
    archivedAt: caseData.archivedAt?.toISOString() ?? null,
    archiveReason: caseData.archiveReason,
    canArchive: canArchiveCase(session.user, caseData),
    canRestore: canRestoreCase(session.user) && caseData.status === "archived",
    delete: checkDeleteEligibility(session.user, {
      status: caseData.status,
      archivedAt: caseData.archivedAt,
      heldSessionsCount,
      paidInvoicesCount,
    }),
  };

  const [flowStages, firstStage, taskUsers, teamUsers] = await Promise.all([
    getCaseFlowStages(caseData.caseType),
    getFirstStage(caseData.caseType),
    getAssignableUsers(prisma, { id: session.user.id, role: session.user.role }),
    // مرشّحو تشكيل الفريق (لمودال تعديل الفريق).
    prisma.user.findMany({
      where: {
        role: { in: ["system_admin", "supervisor", "lawyer", "researcher"] },
        isActive: true,
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true },
    }),
  ]);
  const settlementPlatform = getAmicableSettlementPlatform(caseData.caseType);

  const serializedCase = {
    ...caseData,
    claimValue: caseData.claimValue ? Number(caseData.claimValue) : null,
    sessions: caseData.sessions.map((s) => ({
      ...s,
      preparationChecklist: s.preparationChecklist.map((t) => ({
        id: t.id,
        taskType: t.taskType,
        title: t.title,
        description: t.description,
        isCompleted: t.isCompleted,
        completedByName: t.completedBy?.fullName ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        notes: t.notes,
      })),
    })),
  };

  const memos = caseData.memos.map((m) => ({
    id: m.id,
    title: m.title,
    memoType: m.memoType,
    status: m.status,
    authorName: m.authoredBy.fullName,
    updatedAt: m.updatedAt.toISOString(),
  }));
  const pendingMemoReview = canReviewMemo(session.user.role)
    ? caseData.memos.filter((m) => m.status === "submitted").length
    : 0;

  const tasks = caseData.tasks.map((t) => ({
    id: t.id,
    taskNumber: t.taskNumber,
    title: t.title,
    status: displayTaskStatus(t),
    assignedToName: t.assignedTo.fullName,
    dueDate: t.dueDate?.toISOString() ?? null,
  }));

  return (
    <CaseDetailView
      caseData={serializedCase}
      canEdit={canEditCase(session.user, caseData)}
      flowStages={flowStages}
      firstStage={firstStage}
      settlementPlatform={settlementPlatform}
      currentUserId={session.user.id}
      userRole={session.user.role}
      isSystemAdmin={isSystemAdmin(session.user.role)}
      memos={memos}
      canAddMemo={canAuthorMemo(session.user.role)}
      pendingMemoReview={pendingMemoReview}
      tasks={tasks}
      taskUsers={taskUsers}
      teamUsers={teamUsers}
      archiveInfo={archiveInfo}
    />
  );
}
