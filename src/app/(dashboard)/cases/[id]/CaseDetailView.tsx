"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  AmicableSettlement,
  Case,
  CaseClosureRequest,
  CaseFlowStage,
  CaseParty,
  CaseReopenLog,
  CaseTeamMember,
  Client,
  Document,
  DocumentVisibility,
  Session as CaseSession,
  SettlementPlatform,
  User,
} from "@prisma/client";
import { CaseStatusBadge } from "@/components/cases/CaseStatusBadge";
import { SettlementPanel } from "@/components/cases/SettlementPanel";
import { CasePipeline } from "@/components/cases/CasePipeline";
import { ClosureRequestBanner } from "@/components/cases/ClosureRequestBanner";
import { ClosedCaseBanner } from "@/components/cases/ClosedCaseBanner";
import { ScheduleSessionModal } from "@/components/modals/ScheduleSessionModal";
import { UploadDocumentModal } from "@/components/modals/UploadDocumentModal";
import { CaseClosureModal } from "@/components/modals/CaseClosureModal";
import { NewTaskModal } from "@/components/modals/NewTaskModal";
import { EditCourtNumberModal } from "@/components/modals/EditCourtNumberModal";
import { AddAgencyModal } from "@/components/modals/AddAgencyModal";
import { CaseNumberDisplay } from "@/components/cases/CaseNumberDisplay";
import { EditEntityModal, type EditableFieldDescriptor } from "@/components/shared/EditEntityModal";
import { EntityChangeLog } from "@/components/shared/EntityChangeLog";
import { canEditField } from "@/lib/editPermissions";
import { CLIENT_PARTY_ROLE_OPTIONS } from "@/lib/parties";
import { formatDualDate, formatDualDateTime } from "@/lib/dateUtils";
import { canTransitionToPendingClosure } from "@/lib/caseClosure";
import { MEMO_STATUS_LABELS_AR, MEMO_STATUS_STYLES } from "@/lib/memos";
import { TASK_STATUS_LABELS_AR, TASK_STATUS_STYLES } from "@/lib/tasks";
import { PARTY_ROLE_LABELS_AR } from "@/lib/parties";
import { toEnglishDigits } from "@/lib/formatNumber";
import type { MemoStatus, TaskStatus, UserRole } from "@prisma/client";

type CaseMemo = {
  id: string;
  title: string;
  memoType: string;
  status: MemoStatus;
  authorName: string;
  updatedAt: string;
};

type CaseTask = {
  id: string;
  taskNumber: string;
  title: string;
  status: TaskStatus;
  assignedToName: string;
  dueDate: string | null;
};

type FullCase = Omit<Case, "claimValue"> & {
  claimValue: number | null;
  client: Client;
  responsibleLawyer: User;
  parties: (CaseParty & { linkedClient: Client | null })[];
  team: (CaseTeamMember & { user: User })[];
  documents: (Document & { uploadedBy: User })[];
  sessions: CaseSession[];
  amicableSettlement: AmicableSettlement | null;
  closureRequest: (CaseClosureRequest & { requestedBy: User; approvedBy: User | null }) | null;
  reopenLogs: (CaseReopenLog & { reopenedBy: User })[];
};

const CASE_TYPE_LABELS_AR: Record<Case["caseType"], string> = {
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

const TEAM_ROLE_LABELS_AR: Record<CaseTeamMember["roleInCase"], string> = {
  supervisor: "مشرف",
  lawyer: "محامٍ مترافع",
  researcher: "باحث قانوني",
};

const DOCUMENT_VISIBILITY_LABELS_AR: Record<DocumentVisibility, string> = {
  case_team: "فريق القضية",
  partners_only: "مسؤول النظام فقط",
  all_staff: "جميع الموظفين",
};

const DOCUMENT_VISIBILITY_ICON_PATHS: Record<DocumentVisibility, string> = {
  // قفل نصف مفتوح — مرئي لفريق القضية فقط
  case_team: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM8 11V7a4 4 0 118 0",
  // قفل مغلق بالكامل — الشركاء فقط
  partners_only:
    "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM8 11V7a4 4 0 018 0v4",
  // قفل مفتوح — كل الموظفين
  all_staff:
    "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM8 11V7a4 4 0 017.75-1.5",
};

const SESSION_TYPE_LABELS_AR: Record<CaseSession["sessionType"], string> = {
  hearing: "مرافعة",
  initial_listening: "استماع",
  verdict: "نطق حكم",
  arbitration: "تحكيم",
  negotiation_meeting: "جلسة تسوية ودية",
};

const SESSION_STATUS_LABELS_AR: Record<CaseSession["status"], string> = {
  scheduled: "مجدولة",
  held: "انعقدت",
  postponed: "مؤجلة",
};

const SESSION_STATUS_STYLES: Record<CaseSession["status"], string> = {
  scheduled: "bg-taradhi/10 text-taradhi",
  held: "bg-emerald-100 text-emerald-700",
  postponed: "bg-amber-100 text-amber-700",
};

const CASE_QUICK_TEMPLATES: { key: string; label: string }[] = [
  { key: "case_followup", label: "متابعة سير القضية" },
  { key: "case_path", label: "تحديد مسار" },
  { key: "session_report", label: "تقرير جلسة" },
  { key: "case_analysis", label: "تحليل قضية" },
];

/** يحوّل نتيجة canEditField إلى وصف قفل الحقل للمودال. */
function lockState(check: { allowed: boolean; reason?: string }): { locked: boolean; lockReason?: string } {
  return check.allowed ? { locked: false } : { locked: true, lockReason: check.reason };
}

export function CaseDetailView({
  caseData,
  canEdit,
  flowStages,
  firstStage,
  settlementPlatform,
  currentUserId,
  userRole,
  isSystemAdmin,
  memos,
  canAddMemo,
  pendingMemoReview,
  tasks,
  taskUsers,
}: {
  caseData: FullCase;
  canEdit: boolean;
  flowStages: CaseFlowStage[];
  firstStage: CaseFlowStage | null;
  settlementPlatform: SettlementPlatform | null;
  currentUserId: string;
  userRole: UserRole;
  isSystemAdmin: boolean;
  memos: CaseMemo[];
  canAddMemo: boolean;
  pendingMemoReview: number;
  tasks: CaseTask[];
  taskUsers: { id: string; fullName: string; role: UserRole }[];
}) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showCourtNumberModal, setShowCourtNumberModal] = useState(false);
  const [showAddAgency, setShowAddAgency] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // بناء حقول التعديل الموحّد مع حالة القفل حسب دور المستخدم وحالة القضية.
  const lock = (field: string) => canEditField("case", field, userRole, { status: caseData.status });
  const editFields: EditableFieldDescriptor[] = [
    { name: "title", label: "عنوان القضية", type: "text", value: caseData.title, ...lockState(lock("title")) },
    { name: "internalNumber", label: "الرقم الداخلي", type: "text", value: caseData.internalNumber, ...lockState(lock("internalNumber")) },
    { name: "courtCaseNumber", label: "رقم القضية بالمحكمة", type: "text", value: caseData.courtCaseNumber ?? "", ...lockState(lock("courtCaseNumber")) },
    { name: "courtName", label: "المحكمة", type: "text", value: caseData.courtName ?? "", ...lockState(lock("courtName")) },
    {
      name: "caseType",
      label: "نوع القضية",
      type: "select",
      value: caseData.caseType,
      options: Object.entries(CASE_TYPE_LABELS_AR).map(([value, label]) => ({ value, label })),
      ...lockState(lock("caseType")),
    },
    { name: "claimValue", label: "قيمة المطالبة", type: "number", value: caseData.claimValue != null ? String(caseData.claimValue) : "", ...lockState(lock("claimValue")) },
    {
      name: "priority",
      label: "الأولوية",
      type: "select",
      value: caseData.priority,
      options: [
        { value: "normal", label: "عادية" },
        { value: "high", label: "عالية" },
        { value: "urgent", label: "عاجلة" },
      ],
      ...lockState(lock("priority")),
    },
    {
      name: "clientPartyRole",
      label: "صفة موكّلنا",
      type: "select",
      value: caseData.clientPartyRole ?? "",
      options: CLIENT_PARTY_ROLE_OPTIONS.map((r) => ({ value: r, label: PARTY_ROLE_LABELS_AR[r] })),
      ...lockState(lock("clientPartyRole")),
    },
    { name: "notes", label: "الملاحظات", type: "textarea", value: caseData.notes ?? "", ...lockState(lock("notes")) },
  ];

  const canRequestClosure =
    caseData.responsibleLawyerId === currentUserId && canTransitionToPendingClosure(caseData.status);

  const isPendingAgency = caseData.status === "pending_agency";
  const daysSincePending = Math.floor(
    (Date.now() - new Date(caseData.openDate).getTime()) / (24 * 60 * 60 * 1000)
  );

  const now = new Date();
  const nextSession = caseData.sessions.find((s) => new Date(s.sessionDate) >= now) ?? null;

  // أطراف الدعوى: موكّلنا + الطرف المقابل الرئيسي + أطراف إضافية.
  const ourParty = caseData.parties.find((p) => p.isOurClient) ?? null;
  const opposingParties = caseData.parties.filter((p) => !p.isOurClient);
  const primaryOpposing = opposingParties[0] ?? null;
  const additionalParties = opposingParties.slice(1);

  const kpis = [
    { label: "النوع", value: CASE_TYPE_LABELS_AR[caseData.caseType] },
    { label: "المحكمة", value: caseData.courtName ?? "—" },
    {
      label: "تاريخ الفتح",
      value: formatDualDate(caseData.openDate),
    },
    {
      label: "الجلسة القادمة",
      value: nextSession ? formatDualDate(nextSession.sessionDate) : "لا يوجد",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1">
            <CaseNumberDisplay case={caseData} variant="inline" />
          </div>
          <h1 className="font-amiri text-2xl font-bold text-navy">{caseData.title}</h1>
          {ourParty && (
            <p className="mt-1 text-sm">
              <span className="font-semibold text-[#3F7A5C]">
                {ourParty.name} ({PARTY_ROLE_LABELS_AR[ourParty.role]})
              </span>
              {primaryOpposing && (
                <>
                  {" "}
                  <span className="text-foreground/40">ضد</span>{" "}
                  <span className="text-foreground/70">
                    {primaryOpposing.name} ({PARTY_ROLE_LABELS_AR[primaryOpposing.role]})
                  </span>
                </>
              )}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <CaseStatusBadge status={caseData.status} />
            <span className="text-xs text-foreground/50">
              العميل: {caseData.client.fullName}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="rounded-lg border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
            >
              تعديل البيانات
            </button>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="rounded-lg border border-gold px-4 py-2 text-sm font-medium text-gold hover:bg-gold/10"
            >
              رفع مستند
            </button>
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className="rounded-lg bg-taradhi px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              جدولة جلسة
            </button>
            {canRequestClosure && (
              <button
                type="button"
                onClick={() => setShowClosureModal(true)}
                className="rounded-lg border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
              >
                طلب إغلاق القضية
              </button>
            )}
          </div>
        )}
      </div>

      {caseData.status === "pending_closure" && caseData.closureRequest && (
        <ClosureRequestBanner
          caseId={caseData.id}
          closureRequest={caseData.closureRequest}
          isSystemAdmin={isSystemAdmin}
        />
      )}

      {caseData.status === "closed" && (
        <ClosedCaseBanner
          caseId={caseData.id}
          outcome={caseData.outcome}
          closedDate={caseData.closedDate}
          approvedByName={caseData.closureRequest?.approvedBy?.fullName ?? null}
          isSystemAdmin={isSystemAdmin}
        />
      )}

      {/* بانر: القضية قيد إصدار الوكالة */}
      {isPendingAgency && (
        <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-semibold text-yellow-900">
                ⏳ القضية قيد إصدار الوكالة
              </p>
              <p className="mt-1.5 text-sm text-yellow-800">
                الفريق يستطيع العمل التحضيري، لكن لا يمكن جدولة جلسة محكمة قبل صدور الوكالة الشرعية.
              </p>
              <p className="mt-2 text-xs text-yellow-700">
                عدد الأيام منذ التفعيل:{" "}
                <span className="font-semibold">{toEnglishDigits(daysSincePending)}</span>{" "}
                {daysSincePending === 1 ? "يوم" : "يومًا"}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowAddAgency(true)}
                className="shrink-0 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                إضافة رقم الوكالة ←
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <p className="text-xs text-foreground/50">{kpi.label}</p>
            <p className="mt-1.5 truncate font-amiri text-lg font-bold text-navy">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* بانر تنبيه: لم يُضَف رقم المحكمة الرسمي بعد */}
      {canEdit && !caseData.courtCaseNumber && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ لم يُضَف رقم القضية الرسمي (من المحكمة) بعد
          </p>
          <button
            type="button"
            onClick={() => setShowCourtNumberModal(true)}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            إضافة رقم المحكمة
          </button>
        </div>
      )}

      {/* بطاقة أرقام القضية */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy">أرقام القضية</h2>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCourtNumberModal(true)}
              className="rounded-lg border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy/5"
            >
              {caseData.courtCaseNumber ? "تعديل رقم المحكمة" : "إضافة رقم المحكمة"}
            </button>
          )}
        </div>
        <CaseNumberDisplay case={caseData} variant="detailed" />
      </section>

      {/* بطاقة أطراف الدعوى البارزة */}
      <section>
        <h2 className="mb-3 font-semibold text-navy">أطراف الدعوى</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* موكّلنا */}
          <div
            className="rounded-xl border-2 p-5"
            style={{ backgroundColor: "#E6F0EA", borderColor: "#3F7A5C" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: "#3F7A5C" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5">
                  <path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                موكّلنا
              </span>
              {ourParty && (
                <span className="text-xs font-medium" style={{ color: "#3F7A5C" }}>
                  {PARTY_ROLE_LABELS_AR[ourParty.role]}
                </span>
              )}
            </div>
            {ourParty ? (
              <>
                <p className="font-amiri text-lg font-bold text-navy">{ourParty.name}</p>
                {ourParty.identityNumber && (
                  <p className="mt-1 text-sm text-foreground/60" dir="ltr">
                    {toEnglishDigits(ourParty.identityNumber)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-foreground/50">لم تُسجَّل صفة موكّلنا بعد</p>
            )}
          </div>

          {/* الطرف المقابل */}
          <div className="rounded-xl border border-black/10 bg-gray-50 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700">
                الطرف المقابل
              </span>
              {primaryOpposing && (
                <span className="text-xs font-medium text-foreground/60">
                  {PARTY_ROLE_LABELS_AR[primaryOpposing.role]}
                </span>
              )}
            </div>
            {primaryOpposing ? (
              <>
                <p className="font-amiri text-lg font-bold text-navy">{primaryOpposing.name}</p>
                {primaryOpposing.identityNumber && (
                  <p className="mt-1 text-sm text-foreground/60" dir="ltr">
                    {toEnglishDigits(primaryOpposing.identityNumber)}
                  </p>
                )}
                {primaryOpposing.opposingCounsel && (
                  <p className="mt-1 text-sm text-foreground/60">
                    محاميه: {primaryOpposing.opposingCounsel}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-foreground/50">لا يوجد طرف مقابل مسجّل</p>
            )}
          </div>
        </div>

        {additionalParties.length > 0 && (
          <div className="mt-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium text-navy">أطراف إضافية</p>
            <ul className="space-y-1.5 text-sm">
              {additionalParties.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span className="text-navy">{p.name}</span>
                  <span className="text-xs text-foreground/50">{PARTY_ROLE_LABELS_AR[p.role]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-navy">نماذج القضية</h2>
        <div className="flex flex-wrap gap-2">
          {CASE_QUICK_TEMPLATES.map((t) => (
            <Link
              key={t.key}
              href={`/templates/${t.key}/fill?caseId=${caseData.id}`}
              className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy">المذكرات</h2>
          {canAddMemo && (
            <Link
              href={`/memos/new?caseId=${caseData.id}`}
              className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
            >
              + مذكرة جديدة
            </Link>
          )}
        </div>

        {pendingMemoReview > 0 && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
            {pendingMemoReview} مذكرة بانتظار مراجعتك
          </div>
        )}

        {memos.length === 0 ? (
          <p className="text-sm text-foreground/50">لا توجد مذكرات لهذه القضية</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {memos.map((memo) => (
              <li key={memo.id} className="py-2.5">
                <Link
                  href={`/memos/${memo.id}`}
                  className="flex items-center justify-between gap-3 text-sm hover:text-taradhi"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy">{memo.title}</p>
                    <p className="text-xs text-foreground/50">
                      {memo.memoType} · {memo.authorName} · {formatDualDate(memo.updatedAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${MEMO_STATUS_STYLES[memo.status]}`}
                  >
                    {MEMO_STATUS_LABELS_AR[memo.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy">المهام</h2>
          <button
            type="button"
            onClick={() => setShowNewTask(true)}
            className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
          >
            + مهمة جديدة
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-foreground/50">لا توجد مهام لهذه القضية</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {tasks.map((t) => (
              <li key={t.id} className="py-2.5">
                <Link href={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-taradhi">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy">{t.title}</p>
                    <p className="text-xs text-foreground/50">
                      <span className="font-mono" dir="ltr">{t.taskNumber}</span> · {t.assignedToName}
                      {t.dueDate ? ` · استحقاق ${formatDualDate(t.dueDate)}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TASK_STATUS_STYLES[t.status]}`}>
                    {TASK_STATUS_LABELS_AR[t.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {firstStage && settlementPlatform && (
        <SettlementPanel
          caseId={caseData.id}
          stage={firstStage}
          platform={settlementPlatform}
          settlement={caseData.amicableSettlement}
          canEdit={canEdit}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-navy">سجل الجلسات</h2>
            {caseData.sessions.length === 0 ? (
              <p className="text-sm text-foreground/50">لا توجد جلسات مجدولة</p>
            ) : (
              <ul className="space-y-2">
                {caseData.sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-black/5 px-4 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-navy">
                        {formatDualDateTime(s.sessionDate)}
                      </p>
                      <p className="text-xs text-foreground/50">
                        {SESSION_TYPE_LABELS_AR[s.sessionType]}
                        {s.court ? ` · ${s.court}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${SESSION_STATUS_STYLES[s.status]}`}
                      >
                        {SESSION_STATUS_LABELS_AR[s.status]}
                      </span>
                      <Link
                        href={`/templates/session_report/fill?caseId=${caseData.id}&sessionId=${s.id}`}
                        className="text-xs text-taradhi hover:underline"
                      >
                        إنشاء تقرير الجلسة
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-black/5 bg-white shadow-sm">
            <h2 className="border-b border-black/5 px-5 py-4 font-semibold text-navy">
              المستندات
            </h2>
            {caseData.documents.length === 0 ? (
              <p className="px-5 py-6 text-sm text-foreground/50">لا توجد مستندات مرفوعة</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-xs text-foreground/50">
                      <th className="px-5 py-2 font-medium">اسم المستند</th>
                      <th className="px-5 py-2 font-medium">رفعه</th>
                      <th className="px-5 py-2 font-medium">الصلاحية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.documents.map((d) => (
                      <tr key={d.id} className="border-b border-black/5 last:border-0">
                        <td className="px-5 py-3">
                          <a
                            href={d.storagePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-taradhi hover:underline"
                          >
                            {d.fileName}
                          </a>
                        </td>
                        <td className="px-5 py-3 text-foreground/60">{d.uploadedBy.fullName}</td>
                        <td className="px-5 py-3">
                          <span
                            title={DOCUMENT_VISIBILITY_LABELS_AR[d.visibilityLevel]}
                            className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-2.5 py-1 text-xs text-navy"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              className="h-3.5 w-3.5"
                            >
                              <path
                                d={DOCUMENT_VISIBILITY_ICON_PATHS[d.visibilityLevel]}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {DOCUMENT_VISIBILITY_LABELS_AR[d.visibilityLevel]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {caseData.notes && (
            <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-semibold text-navy">ملاحظات</h2>
              <p className="text-sm text-foreground/70 whitespace-pre-wrap">{caseData.notes}</p>
            </section>
          )}

          {caseData.reopenLogs.length > 0 && (
            <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-navy">سجل إعادة الفتح</h2>
              <ul className="space-y-3">
                {caseData.reopenLogs.map((log) => (
                  <li key={log.id} className="rounded-lg border border-black/5 px-4 py-2.5 text-sm">
                    <p className="font-medium text-navy">
                      {log.reopenedBy.fullName} — {formatDualDateTime(log.reopenedAt)}
                    </p>
                    <p className="mt-1 text-foreground/70 whitespace-pre-wrap">{log.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-navy">الفريق المسند</h2>
            <ul className="space-y-2 text-sm">
              {caseData.team.map((member) => (
                <li key={member.id} className="flex items-center justify-between">
                  <span>{member.user.fullName}</span>
                  <span className="text-xs text-foreground/50">
                    {TEAM_ROLE_LABELS_AR[member.roleInCase]}
                  </span>
                </li>
              ))}
              {caseData.team.length === 0 && (
                <p className="text-sm text-foreground/50">لا يوجد أعضاء مسندون</p>
              )}
            </ul>
          </section>

          <CasePipeline stages={flowStages} status={caseData.status} />
        </div>
      </div>

      <EntityChangeLog entityType="case" entityId={caseData.id} />

      {showScheduleModal && (
        <ScheduleSessionModal
          caseId={caseData.id}
          defaultCourt={caseData.courtName}
          pendingAgency={isPendingAgency}
          onAddAgency={() => {
            setShowScheduleModal(false);
            setShowAddAgency(true);
          }}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
      {showUploadModal && (
        <UploadDocumentModal caseId={caseData.id} onClose={() => setShowUploadModal(false)} />
      )}
      {showClosureModal && (
        <CaseClosureModal caseId={caseData.id} onClose={() => setShowClosureModal(false)} />
      )}
      {showNewTask && (
        <NewTaskModal
          users={taskUsers}
          presetCaseId={caseData.id}
          currentUserId={currentUserId}
          onClose={() => setShowNewTask(false)}
        />
      )}
      {showCourtNumberModal && (
        <EditCourtNumberModal
          caseId={caseData.id}
          currentValue={caseData.courtCaseNumber}
          onClose={() => setShowCourtNumberModal(false)}
        />
      )}
      {showAddAgency && (
        <AddAgencyModal caseId={caseData.id} onClose={() => setShowAddAgency(false)} />
      )}
      {showEditModal && (
        <EditEntityModal
          entityType="case"
          entityId={caseData.id}
          apiPath={`/api/cases/${caseData.id}`}
          title="تعديل بيانات القضية"
          fields={editFields}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
