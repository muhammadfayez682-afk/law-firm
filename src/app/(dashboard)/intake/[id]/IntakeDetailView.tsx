"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import type {
  CaseType,
  ConflictCheckResult,
  IntakeSource,
  IntakeStatus,
  PartyRole,
  RejectionReason,
  TaskStatus,
  UserRole,
} from "@prisma/client";
import {
  CONFLICT_RESULT_LABELS_AR,
  CONFLICT_RESULT_STYLES,
  INTAKE_SOURCE_LABELS_AR,
  INTAKE_STAGES,
  INTAKE_STATUS_LABELS_AR,
  INTAKE_STATUS_STYLES,
  intakeStageIndex,
  REJECTION_REASON_LABELS_AR,
} from "@/lib/intake";
import { TASK_STATUS_LABELS_AR, TASK_STATUS_STYLES } from "@/lib/tasks";
import { CLIENT_PARTY_ROLE_OPTIONS, PARTY_ROLE_LABELS_AR } from "@/lib/parties";
import { formatDualDate, formatDualDateTime } from "@/lib/dateUtils";
import { formatCurrency, toEnglishDigits } from "@/lib/formatNumber";
import { NewTaskModal } from "@/components/modals/NewTaskModal";
import { TeamFormationFields, EMPTY_TEAM, type TeamState } from "@/components/cases/TeamFormationFields";

type IntakeData = {
  id: string;
  requestNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  clientIdNumber: string | null;
  disputeSummary: string;
  opposingParty: string | null;
  proposedType: CaseType | null;
  source: IntakeSource;
  referredBy: string | null;
  receivedByName: string;
  receivedAt: string;
  status: IntakeStatus;
  conflictResult: ConflictCheckResult;
  conflictNotes: string | null;
  legalBasis: string | null;
  strengths: string | null;
  weaknesses: string | null;
  jurisdiction: string | null;
  estimatedDuration: string | null;
  proposedFee: number | null;
  evidence: string | null;
  finalDirection: string | null;
  approverNotes: string | null;
  assessedAt: string | null;
  assessmentByName: string | null;
  assessmentApprovedAt: string | null;
  assessmentApprovedByName: string | null;
  assessmentDelegatedToId: string | null;
  assessmentDelegatedToName: string | null;
  assessmentDelegatedByName: string | null;
  assessmentDelegatedById: string | null;
  assessmentDelegatedAt: string | null;
  decision: string | null;
  decisionByName: string | null;
  rejectionReason: RejectionReason | null;
  rejectionNotes: string | null;
  feeAgreementSignedAt: string | null;
  advancePaymentReceived: boolean;
  caseId: string | null;
  caseInternalNumber: string | null;
  documents: { id: string; title: string; storagePath: string; uploadedByName: string }[];
  notes: { id: string; content: string; authorName: string; createdAt: string }[];
  filledTemplates: {
    id: string;
    templateKey: string;
    templateName: string;
    pdfPath: string | null;
    filledByName: string;
    createdAt: string;
  }[];
  tasks: {
    id: string;
    taskNumber: string;
    title: string;
    status: TaskStatus;
    assignedToName: string;
    dueDate: string | null;
  }[];
};

const CASE_TYPE_LABELS_AR: Record<string, string> = {
  general: "عام", commercial: "تجارية", labor: "عمالية", personal_status: "أحوال شخصية",
  criminal: "جزائية", administrative: "إداري", committee: "لجان", arbitration: "تحكيم",
  debt_collection: "تحصيل ديون", other: "أخرى",
};

const inputClass = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-gold";
const labelClass = "mb-1.5 block text-sm font-medium text-navy";

export function IntakeDetailView({
  intake,
  lawyers,
  teamUsers,
  canAssess,
  canDecide,
  canActivate,
  canApprove,
  canDelegate,
  currentUserId,
  delegateUsers,
  taskUsers,
  intakeTemplates,
}: {
  intake: IntakeData;
  lawyers: { id: string; fullName: string }[];
  teamUsers: { id: string; fullName: string; role: UserRole }[];
  canAssess: boolean;
  canDecide: boolean;
  canActivate: boolean;
  canApprove: boolean;
  canDelegate: boolean;
  currentUserId: string;
  delegateUsers: { id: string; fullName: string; role: UserRole }[];
  taskUsers: { id: string; fullName: string; role: UserRole }[];
  intakeTemplates: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [approverNotes, setApproverNotes] = useState("");
  const activeStage = intakeStageIndex(intake.status);
  const isDecided = intake.status === "accepted" || intake.status === "rejected";
  const isDelegated = Boolean(intake.assessmentDelegatedToId);
  // الحقول الإلزامية الأربعة الناقصة (يُعامل "0"/الفراغ كغير معبّأ) — للتحقق قبل زر الاعتماد.
  const isFilled = (v: string | null) => !!v && v.trim() !== "" && v.trim() !== "0";
  const mandatoryMissing = (
    [
      ["التكييف القانوني", intake.legalBasis],
      ["الاختصاص القضائي", intake.jurisdiction],
      ["نقاط القوة", intake.strengths],
      ["نقاط الضعف", intake.weaknesses],
      ["التوجّه النهائي", intake.finalDirection],
    ] as const
  )
    .filter(([, v]) => !isFilled(v))
    .map(([l]) => l);

  async function post(url: string, body?: unknown, okMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تنفيذ العملية.");
        return null;
      }
      if (okMsg) toast.success(okMsg);
      router.refresh();
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function del(url: string, okMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "تعذّر تنفيذ العملية.");
        return null;
      }
      if (okMsg) toast.success(okMsg);
      router.refresh();
      return data;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-foreground/50" dir="ltr">{intake.requestNumber}</p>
          <h1 className="font-amiri text-2xl font-bold text-navy">{intake.clientName}</h1>
          <div className="mt-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${INTAKE_STATUS_STYLES[intake.status]}`}>
              {INTAKE_STATUS_LABELS_AR[intake.status]}
            </span>
          </div>
        </div>
        <Link href="/intake" className="text-sm text-gold hover:underline">العودة للطلبات</Link>
      </div>

      {/* شريط التقدم */}
      <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          {INTAKE_STAGES.map((stage, i) => {
            const order = i + 1;
            const done = activeStage > order;
            const active = activeStage === order;
            return (
              <div key={stage.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    done ? "bg-gold text-navy" : active ? "bg-taradhi text-white ring-2 ring-taradhi/30" : "bg-gray-100 text-gray-400"
                  }`}>
                    {done ? "✓" : toEnglishDigits(order)}
                  </span>
                  <span className={`text-xs ${active ? "font-semibold text-navy" : "text-foreground/50"}`}>{stage.label}</span>
                </div>
                {i < INTAKE_STAGES.length - 1 && (
                  <div className={`mx-1 h-0.5 flex-1 ${done ? "bg-gold" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {intake.caseId && (
        <Link href={`/cases/${intake.caseId}`} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 hover:bg-emerald-100">
          <span className="font-semibold text-emerald-800">تم تفعيل القضية {intake.caseInternalNumber}</span>
          <span className="text-sm text-emerald-700">عرض القضية ←</span>
        </Link>
      )}

      {/* قسم 1: بيانات الاستقبال */}
      <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-navy">بيانات الاستقبال</h2>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="الجوال" value={toEnglishDigits(intake.clientPhone)} dir="ltr" />
          <Field label="البريد" value={intake.clientEmail ?? "—"} dir="ltr" />
          <Field label="الهوية/السجل" value={intake.clientIdNumber ? toEnglishDigits(intake.clientIdNumber) : "—"} dir="ltr" />
          <Field label="الطرف المقابل" value={intake.opposingParty ?? "—"} />
          <Field label="النوع المقترح" value={intake.proposedType ? CASE_TYPE_LABELS_AR[intake.proposedType] : "—"} />
          <Field label="المصدر" value={INTAKE_SOURCE_LABELS_AR[intake.source]} />
          <Field label="أحاله" value={intake.referredBy ?? "—"} />
          <Field label="المستلم" value={intake.receivedByName} />
          <Field label="تاريخ الاستقبال" value={formatDualDate(intake.receivedAt)} dir="ltr" />
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs text-foreground/50">ملخص النزاع</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-foreground/80">{intake.disputeSummary}</dd>
          </div>
        </dl>
      </section>

      {/* قسم 2: نتيجة فحص التعارض */}
      <section className={`rounded-xl border p-5 shadow-sm ${intake.conflictResult === "confirmed" ? "border-red-300 bg-red-50" : "border-black/5 bg-white"}`}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-navy">فحص تعارض المصالح</h2>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${CONFLICT_RESULT_STYLES[intake.conflictResult]}`}>
            {CONFLICT_RESULT_LABELS_AR[intake.conflictResult]}
          </span>
        </div>
        <p className="text-sm text-foreground/70">{intake.conflictNotes ?? "—"}</p>
        {intake.conflictResult === "confirmed" && (
          <p className="mt-2 text-sm font-semibold text-red-700">
            ⚠️ تعارض مصالح مؤكد — لا يُنصح بقبول القضية إلا بمراجعة مسؤول النظام.
          </p>
        )}
        {!isDecided && (
          <button type="button" disabled={busy} onClick={() => post(`/api/intake/${intake.id}/conflict-check`, undefined, "أُعيد فحص التعارض")}
            className="mt-3 rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5 disabled:opacity-60">
            إعادة الفحص
          </button>
        )}
      </section>

      {/* التفويض: بانر أو زر تفويض التقييم */}
      {!isDecided && (isDelegated || canDelegate) && (
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          {isDelegated ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-navy">
                  التقييم مُفوَّض إلى{" "}
                  <span className="font-semibold text-taradhi">{intake.assessmentDelegatedToName}</span>
                  {intake.assessmentDelegatedByName ? ` من ${intake.assessmentDelegatedByName}` : ""}
                </p>
                {intake.assessmentDelegatedAt && (
                  <p className="mt-0.5 text-xs text-foreground/50" dir="ltr">
                    {formatDualDateTime(intake.assessmentDelegatedAt)}
                  </p>
                )}
              </div>
              {(canDelegate || intake.assessmentDelegatedById === currentUserId) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => del(`/api/intake/${intake.id}/delegate-assessment`, "أُلغي التفويض")}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  إلغاء التفويض
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-navy">دراسة التقييم</h2>
                <p className="mt-0.5 text-sm text-foreground/60">
                  قيّم بنفسك أدناه، أو فوّض التقييم لموظف آخر ليعدّه ويعيده لك للقرار.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDelegate(true)}
                className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
              >
                تفويض التقييم
              </button>
            </div>
          )}
        </section>
      )}

      {/* قسم 3: دراسة التقييم — متاح لأي مستخدم يملك رؤية الطلب (تعبئة، لا اعتماد) */}
      {canAssess && !isDecided && !intake.assessmentApprovedAt && (
        <AssessmentForm
          intake={intake}
          busy={busy}
          onCreateTask={() => setShowNewTask(true)}
          onSave={(body) => post(`/api/intake/${intake.id}/assessment`, body, "تم حفظ التقييم")}
        />
      )}
      {(!canAssess || isDecided || intake.assessmentApprovedAt) && intake.assessedAt && (
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">دراسة التقييم</h2>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Field label="الوقائع" value={intake.disputeSummary ?? "—"} />
            <Field label="البينات والأسانيد" value={intake.evidence ?? "—"} />
            <Field label="التكييف القانوني" value={intake.legalBasis ?? "—"} />
            <Field label="الاختصاص القضائي" value={intake.jurisdiction ?? "—"} />
            <Field label="نقاط القوة" value={intake.strengths ?? "—"} />
            <Field label="نقاط الضعف" value={intake.weaknesses ?? "—"} />
            <Field label="المدة التقريبية" value={intake.estimatedDuration ?? "—"} />
            <Field label="الأتعاب المقترحة" value={intake.proposedFee !== null ? formatCurrency(intake.proposedFee) : "—"} />
            <Field label="التوجّه النهائي" value={intake.finalDirection ?? "—"} />
            {intake.approverNotes && <Field label="ملاحظات المسؤول" value={intake.approverNotes} />}
          </dl>
        </section>
      )}

      {/* اعتماد التقييم — بوّابة إلزامية للتفعيل (مسؤول النظام) */}
      {intake.assessedAt && intake.status !== "rejected" && intake.status !== "cancelled" && !intake.caseId && (
        <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          {intake.assessmentApprovedAt ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-700">
                ✅ التقييم معتمد{intake.assessmentApprovedByName ? ` من ${intake.assessmentApprovedByName}` : ""}
                <span className="text-xs font-normal text-foreground/50">{formatDualDateTime(intake.assessmentApprovedAt)}</span>
              </p>
              <a
                href={`/api/intake/${intake.id}/assessment-pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-navy/20 px-4 py-1.5 text-sm font-medium text-navy hover:bg-navy/5"
              >
                📄 تصدير PDF
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-amber-800">⏳ التقييم بانتظار اعتماد المسؤول</p>
                {mandatoryMissing.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">حقول إلزامية ناقصة: {mandatoryMissing.join("، ")}</p>
                )}
              </div>
              {canApprove && (
                <>
                  <div>
                    <label className={labelClass}>ملاحظات واقتراحات المسؤول (اختياري)</label>
                    <textarea
                      value={approverNotes}
                      onChange={(e) => setApproverNotes(e.target.value)}
                      rows={2}
                      className={inputClass}
                      placeholder="ملاحظات تُحفظ مع الاعتماد وتظهر في التقرير..."
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy || mandatoryMissing.length > 0}
                      title={mandatoryMissing.length > 0 ? "أكمل الحقول الإلزامية الخمسة أولًا" : undefined}
                      onClick={() => post(`/api/intake/${intake.id}/approve-assessment`, { approverNotes: approverNotes.trim() || null }, "تم اعتماد التقييم")}
                      className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      اعتماد التقييم
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* رفض الطلب — للإدارة/المشرف (القبول صار عبر اعتماد التقييم) */}
      {canDecide && !isDecided && !intake.assessmentApprovedAt && intake.assessedAt && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} onClick={() => setShowReject(true)}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            رفض الطلب
          </button>
        </div>
      )}

      {/* قسم 4: عقد الأتعاب + التفعيل — بعد اعتماد التقييم فقط */}
      {intake.assessmentApprovedAt && !intake.caseId && canActivate && (
        <section className="rounded-xl border-2 border-gold/40 bg-gold/5 p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">عقد الأتعاب وتفعيل القضية</h2>
          <p className="mb-3 text-sm text-foreground/70">
            الأتعاب المقترحة: <span className="font-semibold">{intake.proposedFee !== null ? formatCurrency(intake.proposedFee) : "—"}</span>
          </p>
          <label className="mb-3 flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" defaultChecked={intake.advancePaymentReceived}
              onChange={(e) => post(`/api/intake/${intake.id}`, { advancePaymentReceived: e.target.checked })}
              className="rounded" />
            تم استلام الدفعة المقدمة
          </label>
          <p className="mb-3 text-xs text-foreground/50">
            بعد التفعيل تُنشأ القضية والعميل والأطراف، وتُنقل المستندات، ويُفتح تشكيل الفريق.
          </p>
          <button type="button" onClick={() => setShowActivate(true)}
            className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            تفعيل القضية
          </button>
        </section>
      )}

      {/* قرار الرفض المعروض */}
      {intake.status === "rejected" && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-red-800">طلب مرفوض</h2>
          <p className="text-sm text-red-700">
            السبب: {intake.rejectionReason ? REJECTION_REASON_LABELS_AR[intake.rejectionReason] : "—"}
            {intake.decisionByName ? ` · بقرار ${intake.decisionByName}` : ""}
          </p>
          {intake.rejectionNotes && <p className="mt-1 text-sm text-red-700/80">{intake.rejectionNotes}</p>}
        </section>
      )}

      {/* النماذج المطلوبة قبل الاعتماد */}
      {!isDecided && intakeTemplates.length > 0 && (
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-navy">النماذج المطلوبة قبل الاعتماد</h2>
          <p className="mb-3 text-xs text-foreground/50">
            نماذج تُعبّأ في مرحلة الاستلام (تنتقل تلقائيًا للقضية عند التفعيل).
          </p>
          <div className="flex flex-wrap gap-2">
            {intakeTemplates.map((t) => (
              <Link
                key={t.key}
                href={`/templates/${t.key}/fill?intakeId=${intake.id}`}
                className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5"
              >
                {t.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {intake.filledTemplates.length > 0 && (
        <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy">النماذج المعبّأة</h2>
          <ul className="divide-y divide-black/5 text-sm">
            {intake.filledTemplates.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-navy">{f.templateName}</p>
                  <p className="text-xs text-foreground/40">
                    {f.filledByName} · {formatDualDate(f.createdAt)}
                  </p>
                </div>
                {f.pdfPath ? (
                  <a href={f.pdfPath} target="_blank" rel="noopener noreferrer" className="shrink-0 text-taradhi hover:underline">
                    عرض PDF
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-foreground/40">مسودة</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* المهام المرتبطة بالطلب */}
      <TasksSection
        tasks={intake.tasks}
        onNewTask={() => setShowNewTask(true)}
      />

      {/* قسم 5: المستندات */}
      <DocumentsSection intake={intake} />

      {/* قسم 6: الملاحظات */}
      <NotesSection intake={intake} />

      {showDelegate && (
        <DelegateModal
          intakeId={intake.id}
          users={delegateUsers}
          onClose={() => setShowDelegate(false)}
        />
      )}
      {showNewTask && (
        <NewTaskModal
          users={taskUsers}
          presetIntakeId={intake.id}
          currentUserId={currentUserId}
          onClose={() => setShowNewTask(false)}
        />
      )}
      {showReject && <RejectModal intakeId={intake.id} onClose={() => setShowReject(false)} />}
      {showActivate && (
        <ActivateModal
          intake={intake}
          teamUsers={teamUsers}
          onClose={() => setShowActivate(false)}
        />
      )}
    </div>
  );
}

function Field({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div>
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="mt-0.5 text-foreground/80" dir={dir}>{value}</dd>
    </div>
  );
}

function TasksSection({
  tasks,
  onNewTask,
}: {
  tasks: IntakeData["tasks"];
  onNewTask: () => void;
}) {
  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy">المهام</h2>
        <button
          type="button"
          onClick={onNewTask}
          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
        >
          + مهمة جديدة
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-foreground/50">لا توجد مهام مرتبطة بهذا الطلب</p>
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
  );
}

function DelegateModal({
  intakeId,
  users,
  onClose,
}: {
  intakeId: string;
  users: { id: string; fullName: string; role: UserRole }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/intake/${intakeId}/delegate-assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delegateToId: fd.get("delegateToId"), note: fd.get("note") }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(d?.error ?? "تعذّر التفويض.");
        return;
      }
      toast.success("تم تفويض التقييم");
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="تفويض التقييم" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>الموظف المُفوَّض <span className="text-red-600">*</span></label>
          <select name="delegateToId" required defaultValue="" className={inputClass}>
            <option value="" disabled>اختر الموظف</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>ملاحظة تفويض</label>
          <textarea name="note" rows={3} className={inputClass} placeholder="اختياري" />
        </div>
        <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
            {loading ? "جارٍ..." : "تفويض"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AssessmentForm({
  intake,
  busy,
  onCreateTask,
  onSave,
}: {
  intake: IntakeData;
  busy: boolean;
  onCreateTask: () => void;
  onSave: (body: unknown) => void;
}) {
  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy">دراسة التقييم</h2>
        <button
          type="button"
          onClick={onCreateTask}
          className="rounded-lg border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy/5"
        >
          + إنشاء مهمة
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSave({
            legalBasis: fd.get("legalBasis"), strengths: fd.get("strengths"),
            weaknesses: fd.get("weaknesses"), jurisdiction: fd.get("jurisdiction"),
            estimatedDuration: fd.get("estimatedDuration"), proposedFee: fd.get("proposedFee"),
            evidence: fd.get("evidence"), finalDirection: fd.get("finalDirection"),
          });
        }}
        className="space-y-4"
      >
        <p className="text-xs text-foreground/50">الحقول المعلّمة بـ <span className="text-red-600">*</span> إلزامية لاعتماد التقييم.</p>

        {/* الوقائع (من ملخص النزاع المسجّل عند الاستلام) */}
        <div>
          <label className={labelClass}>الوقائع</label>
          <div className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-sm whitespace-pre-wrap text-foreground/80">
            {intake.disputeSummary || "—"}
          </div>
        </div>

        {/* البينات والأسانيد + المستندات المرفقة على الطلب */}
        <div>
          <label className={labelClass}>البينات والأسانيد</label>
          <textarea name="evidence" defaultValue={intake.evidence ?? ""} rows={2} className={inputClass} placeholder="وصف موجز للأدلة والمستندات المؤيّدة..." />
          <div className="mt-2 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs">
            <span className="font-medium text-navy">المستندات المرفقة: </span>
            {intake.documents.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-foreground/70">
                {intake.documents.map((d) => <li key={d.id}>{d.title}</li>)}
              </ul>
            ) : (
              <span className="text-foreground/50">لا مستندات — أرفِقها من قسم «المستندات» أدناه.</span>
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>التكييف القانوني <span className="text-red-600">*</span></label>
          <textarea name="legalBasis" defaultValue={intake.legalBasis ?? ""} rows={2} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>الاختصاص القضائي <span className="text-red-600">*</span></label>
          <input name="jurisdiction" defaultValue={intake.jurisdiction ?? ""} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>نقاط القوة <span className="text-red-600">*</span></label>
            <textarea name="strengths" defaultValue={intake.strengths ?? ""} rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>نقاط الضعف <span className="text-red-600">*</span></label>
            <textarea name="weaknesses" defaultValue={intake.weaknesses ?? ""} rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>المدة التقريبية</label>
            <input name="estimatedDuration" defaultValue={intake.estimatedDuration ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>الأتعاب المقترحة (ر.س)</label>
            <input name="proposedFee" type="number" step="0.01" min="0" defaultValue={intake.proposedFee ?? ""} className={inputClass} dir="ltr" />
          </div>
        </div>
        <div>
          <label className={labelClass}>التوجّه النهائي <span className="text-red-600">*</span></label>
          <textarea name="finalDirection" defaultValue={intake.finalDirection ?? ""} rows={2} className={inputClass} placeholder="الخلاصة والتوصية النهائية لمسار القضية..." />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
            حفظ التقييم
          </button>
        </div>
      </form>
    </section>
  );
}

function DocumentsSection({ intake }: { intake: IntakeData }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", file.name);
      const res = await fetch(`/api/intake/${intake.id}/documents`, { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "تعذّر رفع الملف.");
        return;
      }
      toast.success("تم رفع المستند");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy">المستندات الأولية</h2>
        <label className="cursor-pointer rounded-lg border border-gold px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/10">
          {uploading ? "جارٍ الرفع..." : "+ رفع مستند"}
          <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>
      {intake.documents.length === 0 ? (
        <p className="text-sm text-foreground/50">لا توجد مستندات</p>
      ) : (
        <ul className="divide-y divide-black/5 text-sm">
          {intake.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2">
              <a href={d.storagePath} target="_blank" rel="noopener noreferrer" className="text-taradhi hover:underline">{d.title}</a>
              <span className="text-xs text-foreground/40">{d.uploadedByName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotesSection({ intake }: { intake: IntakeData }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/intake/${intake.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        toast.error(d?.error ?? "تعذّر إضافة الملاحظة.");
        return;
      }
      setContent("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-navy">الملاحظات</h2>
      <div className="mb-3 flex gap-2">
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="أضف ملاحظة..." className={inputClass} />
        <button type="button" onClick={addNote} disabled={saving || !content.trim()} className="shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
          إضافة
        </button>
      </div>
      {intake.notes.length === 0 ? (
        <p className="text-sm text-foreground/50">لا توجد ملاحظات</p>
      ) : (
        <ul className="space-y-2">
          {intake.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-black/5 p-3 text-sm">
              <p className="text-foreground/80">{n.content}</p>
              <p className="mt-1 text-xs text-foreground/40">{n.authorName} · {formatDualDateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RejectModal({ intakeId, onClose }: { intakeId: string; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/intake/${intakeId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "rejected", reason: fd.get("reason"), notes: fd.get("notes") }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { toast.error(d?.error ?? "تعذّر رفض الطلب."); return; }
      toast.success("تم رفض الطلب");
      router.refresh();
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <ModalShell title="رفض الطلب" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>سبب الرفض <span className="text-red-600">*</span></label>
          <select name="reason" required defaultValue="" className={inputClass}>
            <option value="" disabled>اختر السبب</option>
            {Object.entries(REJECTION_REASON_LABELS_AR).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>ملاحظات</label>
          <textarea name="notes" rows={3} className={inputClass} />
        </div>
        <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {loading ? "جارٍ..." : "تأكيد الرفض"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ActivateModal({
  intake,
  teamUsers,
  onClose,
}: {
  intake: IntakeData;
  teamUsers: { id: string; fullName: string; role: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // هل الوكالة جاهزة؟ now = املأها الآن · expected = يتوقع إصدارها لاحقًا · none = بعد بدء العمل
  const [agencyMode, setAgencyMode] = useState<"now" | "expected" | "none">("none");
  const [team, setTeam] = useState<TeamState>(EMPTY_TEAM);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!team.leadLawyerId) {
      toast.error("المحامي الرئيسي إلزامي");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/intake/${intake.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: {
            supervisorId: team.supervisorId || null,
            leadLawyerId: team.leadLawyerId,
            coLawyerIds: team.coLawyerIds,
            researcherIds: team.researcherIds,
          },
          clientPartyRole: fd.get("clientPartyRole"),
          caseType: fd.get("caseType"),
          title: fd.get("title") || null,
          clientType: fd.get("clientType"),
          ...(agencyMode === "now"
            ? {
                agencyNumber: fd.get("agencyNumber") || null,
                agencyType: fd.get("agencyType") || "general",
                agencyScope: fd.get("agencyScope") || null,
                agencyIssueDate: fd.get("agencyIssueDate") || null,
                agencyExpiryDate: fd.get("agencyExpiryDate") || null,
              }
            : {}),
          ...(agencyMode === "expected"
            ? { agencyExpectedDate: fd.get("agencyExpectedDate") || null }
            : {}),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { toast.error(d?.error ?? "تعذّر التفعيل."); return; }
      // طلب خدمة → تُنشأ خدمة قانونية بدل قضية.
      if (d.kind === "service") {
        toast.success(`أُنشئت الخدمة ${d.serviceNumber}`);
        router.push(`/services/${d.serviceId}`);
        router.refresh();
        return;
      }
      toast.success(
        d.pendingAgency
          ? `تم تفعيل القضية ${d.internalNumber} — قيد إصدار الوكالة`
          : `تم تفعيل القضية ${d.internalNumber}`
      );
      router.push(`/cases/${d.caseId}`);
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <ModalShell title="تفعيل القضية" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>عنوان القضية</label>
          <input name="title" defaultValue={intake.disputeSummary.slice(0, 60)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>نوع القضية</label>
            <select name="caseType" defaultValue={intake.proposedType ?? "other"} className={inputClass}>
              {Object.entries(CASE_TYPE_LABELS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>صفة موكّلنا</label>
            <select name="clientPartyRole" defaultValue="plaintiff" className={inputClass}>
              {CLIENT_PARTY_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{PARTY_ROLE_LABELS_AR[r]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>نوع العميل</label>
            <select name="clientType" defaultValue="individual" className={inputClass}>
              <option value="individual">فرد</option>
              <option value="company">شركة</option>
            </select>
          </div>
        </div>

        {/* قسم 2: تشكيل فريق القضية */}
        <div className="border-t border-black/5 pt-4">
          <h3 className="mb-3 font-semibold text-navy">👥 تشكيل فريق القضية</h3>
          <TeamFormationFields users={teamUsers} value={team} onChange={setTeam} />
        </div>

        {/* الوكالة: اختيارية عند التفعيل */}
        <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 p-4">
          <label className={labelClass}>هل الوكالة الشرعية جاهزة؟</label>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "now", l: "نعم — أُدخلها الآن" },
              { v: "expected", l: "لا — متى يتوقع إصدارها؟" },
              { v: "none", l: "تُصدر بعد بدء العمل" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setAgencyMode(o.v as "now" | "expected" | "none")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  agencyMode === o.v ? "bg-navy text-white" : "border border-black/10 text-navy hover:bg-black/5"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>

          {agencyMode === "now" && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>رقم الوكالة <span className="text-red-600">*</span></label>
                <input name="agencyNumber" inputMode="numeric" dir="ltr" className={inputClass} placeholder="مثال: 441234567" />
              </div>
              <div>
                <label className={labelClass}>نوع الوكالة</label>
                <select name="agencyType" defaultValue="general" className={inputClass}>
                  <option value="general">عامة</option>
                  <option value="special">خاصة</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>نطاق الصلاحيات</label>
                <textarea name="agencyScope" rows={2} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>تاريخ الإصدار <span className="text-red-600">*</span></label>
                <input name="agencyIssueDate" type="date" dir="ltr" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>تاريخ الانتهاء</label>
                <input name="agencyExpiryDate" type="date" dir="ltr" className={inputClass} />
              </div>
            </div>
          )}

          {agencyMode === "expected" && (
            <div className="mt-4">
              <label className={labelClass}>التاريخ المتوقع لإصدار الوكالة</label>
              <input name="agencyExpectedDate" type="date" dir="ltr" className={inputClass} />
              <p className="mt-1 text-xs text-yellow-700">
                ستُفعّل القضية بحالة «قيد إصدار الوكالة»، ويُستخدم هذا التاريخ لتذكير أدق بالمتابعة.
              </p>
            </div>
          )}

          {agencyMode === "none" && (
            <p className="mt-3 text-xs text-yellow-700">
              ستُفعّل القضية بحالة «قيد إصدار الوكالة» — الفريق يعمل تحضيريًا دون جدولة جلسات محكمة حتى تصدر الوكالة.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-navy hover:bg-black/5">إلغاء</button>
          <button type="submit" disabled={loading} className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
            {loading ? "جارٍ التفعيل..." : "تفعيل القضية"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-amiri text-xl font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
