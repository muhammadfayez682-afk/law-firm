/**
 * سجل الصلاحيات المركزي (مصدر واحد للعرض) — نظام قدوم الحقائق.
 *
 * هذا الملف **بيانات توثيقية** تصف الصلاحيات كما هي مُنفَّذة فعليًا في
 * `src/lib/rbac.ts` والحرّاس في `src/app/api/**` — تُستهلَك في شاشة العرض
 * `/settings/permissions` (للقراءة فقط). لا يُستورد في أي مسار تحكّم؛ ولا يغيّر
 * أي منطق صلاحية عامل. عند تعديل صلاحية في `rbac.ts` تُحدَّث هنا يدويًا لتبقى
 * الشاشة مطابقة (كل صف يشير لدالته المرجعية في التعليق).
 *
 * ⚠️ القيم أدناه مستخرجة حرفيًا من المصدر الفعلي — راجعها عند أي تغيير في rbac.ts.
 */

export const ROLE_ORDER = [
  "system_admin",
  "supervisor",
  "lawyer",
  "researcher",
  "secretary",
  "accountant",
] as const;

export type RoleKey = (typeof ROLE_ORDER)[number];

export const ROLE_LABELS_AR: Record<RoleKey, string> = {
  system_admin: "مسؤول النظام",
  supervisor: "مشرف",
  lawyer: "محامٍ",
  researcher: "باحث",
  secretary: "سكرتير",
  accountant: "محاسب",
};

/** المستوى الذي تُملَك به الصلاحية. */
export type PermissionLevel = "role_global" | "case_scoped" | "delegatable";

/** رمز/دلالة كل مستوى (للمفتاح الدلالي والخلايا). */
export const LEVEL_META: Record<
  PermissionLevel | "none",
  { icon: string; label: string; desc: string }
> = {
  role_global: { icon: "🌍", label: "ثابتة بالدور", desc: "يملكها الدور عمومًا دون اشتراط قضية بعينها." },
  case_scoped: { icon: "🗂️", label: "على مستوى القضية", desc: "لقضايا الدور فقط (عضوية الفريق/محامٍ مسؤول) — لا كل القضايا." },
  delegatable: { icon: "🔑", label: "بالتفويض فقط", desc: "لا يملكها بالأساس، لكن يمكن تفويضها له مؤقتًا من الأعلى في السلسلة." },
  none: { icon: "—", label: "لا يملكها", desc: "لا يملك هذه الصلاحية." },
};

/** قيمة الدور في صلاحية: مستوى، أو «none»، أو مستوى بملاحظة. */
export type RoleAccess =
  | PermissionLevel
  | "none"
  | { level: PermissionLevel | "none"; note?: string };

export interface PermissionDef {
  key: string;
  label: string;
  /** الدالة/الحارس المرجعي في الكود (للتتبّع). */
  source: string;
  roles: Record<RoleKey, RoleAccess>;
  /** إن كانت من الصلاحيات الخمس القابلة للتفويض على مستوى القضية. */
  delegatable?: boolean;
  /** قاعدة منطقية ثابتة مرتبطة (تُوسَم بقفل 🔒). */
  protectedRule?: string;
}

export interface PermissionDomain {
  key: string;
  title: string;
  icon: string;
  permissions: PermissionDef[];
}

// اختصارات تأليف
const G: PermissionLevel = "role_global";
const C: PermissionLevel = "case_scoped";
const K: PermissionLevel = "delegatable";
const N = "none" as const;

export const PERMISSION_DOMAINS: PermissionDomain[] = [
  // ========================= القضايا =========================
  {
    key: "cases",
    title: "القضايا",
    icon: "⚖️",
    permissions: [
      {
        key: "case.create",
        label: "إنشاء قضية جديدة",
        source: "canCreateCase (rbac.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: G, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "case.view",
        label: "رؤية القضايا",
        source: "caseVisibilityWhere / canAccessCase (rbac.ts)",
        protectedRule: "DENY الصريح (تعارض المصالح) يتفوّق دائمًا حتى على عضوية الفريق والتفويض.",
        roles: {
          system_admin: { level: G, note: "كل القضايا دون قيد (الإدارة الوحيدة)." },
          supervisor: { level: C, note: "قضايا فريقه فقط — ليس كل القضايا." },
          lawyer: C,
          researcher: C,
          secretary: { level: C, note: "إن كان عضوًا في فريق القضية." },
          accountant: { level: N, note: "يرى العملاء للفوترة لا تفاصيل القضايا." },
        },
      },
      {
        key: "case.edit",
        label: "تعديل بيانات القضية",
        source: "edit_case — canEditCase / hasBaseCasePermission (rbac.ts)",
        delegatable: true,
        protectedRule: "المحاسب مستثنى؛ DENY يتفوّق؛ ولا تصعيد امتيازات في التفويض.",
        roles: {
          system_admin: G,
          supervisor: C,
          lawyer: C,
          researcher: C,
          secretary: C,
          accountant: N,
        },
      },
      {
        key: "case.archive",
        label: "أرشفة القضية",
        source: "canArchiveCase (caseArchive.ts)",
        roles: {
          system_admin: G,
          supervisor: { level: G, note: "أي قضية مؤهّلة (مغلقة/مُسوّاة)." },
          lawyer: { level: C, note: "قضاياه كمحامٍ مسؤول فقط." },
          researcher: N,
          secretary: N,
          accountant: N,
        },
      },
      {
        key: "case.restore",
        label: "استرجاع قضية مؤرشفة",
        source: "canRestoreCase (caseArchive.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "case.delete",
        label: "الحذف النهائي للقضية",
        source: "checkDeleteEligibility / route permanent-delete",
        protectedRule: "ضوابط صارمة: مؤرشفة + بلا جلسات منعقدة أو فواتير مدفوعة + ≥90 يومًا + تأكيد نصّي حرفي + سبب ≥50 حرفًا. حذف ناعم ثم كرون بعد 30 يومًا.",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "case.closure.request",
        label: "طلب إغلاق القضية",
        source: "canRequestCaseClosure (caseClosure.ts)",
        roles: {
          system_admin: G,
          supervisor: { level: C, note: "أي عضو في فريق القضية." },
          lawyer: { level: C, note: "أي عضو في فريق القضية." },
          researcher: { level: C, note: "أي عضو في فريق القضية." },
          secretary: { level: C, note: "إن كان عضوًا في الفريق." },
          accountant: N,
        },
      },
      {
        key: "case.closure.approve",
        label: "اعتماد أو رفض الإغلاق",
        source: "isSystemAdmin — route closure PATCH",
        protectedRule: "حصري لمسؤول النظام (حوكمة). والإغلاق بحكم يتطلّب صكًا مكتسب القطعية على القضية (منطق القطعية).",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "case.reopen",
        label: "إعادة فتح القضية",
        source: "isSystemAdmin — route reopen",
        protectedRule: "حصري لمسؤول النظام؛ يُسجَّل في CaseReopenLog بسبب إلزامي.",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
    ],
  },

  // ========================= فريق القضية =========================
  {
    key: "team",
    title: "فريق القضية",
    icon: "👥",
    permissions: [
      {
        key: "team.manage",
        label: "تشكيل وتعديل فريق القضية",
        source: "manage_team — hasBaseCasePermission / route team PATCH",
        delegatable: true,
        protectedRule: "أساسه مسؤول النظام أو المشرف (بوصول مباشر)؛ الباقون عبر تفويض فعّال فقط. DENY يتفوّق.",
        roles: {
          system_admin: G,
          supervisor: { level: C, note: "إن كان عضوًا/بوصول مباشر للقضية." },
          lawyer: { level: K, note: "عبر تفويض manage_team من مشرف/مسؤول." },
          researcher: { level: K, note: "عبر تفويض manage_team." },
          secretary: N,
          accountant: N,
        },
      },
    ],
  },

  // ========================= التفويض =========================
  {
    key: "delegation",
    title: "تفويض الصلاحيات",
    icon: "🔑",
    permissions: [
      {
        key: "delegation.grant",
        label: "منح تفويض صلاحية على قضية",
        source: "canDelegateTo / hasBaseCasePermission — route delegations POST",
        protectedRule: "لا تصعيد امتيازات: لا يُفوَّض إلا ما يملكه المُفوِّض بوضعه المباشر، وللأدنى رتبةً فقط، ويسقط إن فقد المُفوِّض صلاحيته. DENY يتفوّق.",
        roles: {
          system_admin: G,
          supervisor: { level: C, note: "لما يملكه على قضايا فريقه." },
          lawyer: { level: C, note: "لما يملكه (edit_case/assign_tasks/…) لأدنى منه." },
          researcher: { level: C, note: "لما يملكه (write_memo/assign_tasks)." },
          secretary: N,
          accountant: N,
        },
      },
      {
        key: "delegation.revoke",
        label: "إلغاء تفويض قائم",
        source: "route delegations PATCH",
        roles: {
          system_admin: G,
          supervisor: { level: C, note: "المُفوِّض أو مسؤول/مشرف." },
          lawyer: { level: C, note: "ما منحه هو." },
          researcher: { level: C, note: "ما منحه هو." },
          secretary: N,
          accountant: N,
        },
      },
    ],
  },

  // ========================= المهام =========================
  {
    key: "tasks",
    title: "المهام",
    icon: "✅",
    permissions: [
      {
        key: "task.create",
        label: "إنشاء مهمة",
        source: "route tasks POST (مصادقة فقط)",
        roles: { system_admin: G, supervisor: G, lawyer: G, researcher: G, secretary: G, accountant: G },
      },
      {
        key: "task.assignAnyone",
        label: "إسناد مهمة لأي موظف",
        source: "canAssignToAnyone (tasks.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "task.assignScoped",
        label: "إسناد لباحث يشاركه فريق قضية",
        source: "canAssignTaskTo (tasks.ts)",
        roles: {
          system_admin: { level: G, note: "ضمن «إسناد لأي موظف»." },
          supervisor: { level: G, note: "ضمن «إسناد لأي موظف»." },
          lawyer: { level: C, note: "لنفسه + لباحث يشاركه فريق القضية." },
          researcher: { level: C, note: "لنفسه + لباحث يشاركه فريق القضية." },
          secretary: { level: C, note: "لنفسه فقط." },
          accountant: { level: C, note: "لنفسه فقط." },
        },
      },
      {
        key: "task.caseLinked",
        label: "إنشاء مهمة مرتبطة بقضية",
        source: "assign_tasks — route tasks POST",
        delegatable: true,
        roles: {
          system_admin: G,
          supervisor: C,
          lawyer: C,
          researcher: C,
          secretary: N,
          accountant: N,
        },
      },
      {
        key: "task.manage",
        label: "تعديل/إلغاء/رفض المهمة",
        source: "canManageTask (tasks.ts)",
        roles: {
          system_admin: G,
          supervisor: G,
          lawyer: { level: C, note: "المهام التي أنشأها." },
          researcher: { level: C, note: "المهام التي أنشأها." },
          secretary: { level: C, note: "المهام التي أنشأها." },
          accountant: { level: C, note: "المهام التي أنشأها." },
        },
      },
      {
        key: "task.status",
        label: "تغيير حالة المهمة / تنفيذها",
        source: "canChangeTaskStatus = canAccessTask (tasks.ts)",
        roles: {
          system_admin: G,
          supervisor: G,
          lawyer: { level: C, note: "المسند إليه أو المُنشئ." },
          researcher: { level: C, note: "المسند إليه أو المُنشئ." },
          secretary: { level: C, note: "المسند إليه أو المُنشئ." },
          accountant: { level: C, note: "المسند إليه أو المُنشئ." },
        },
      },
    ],
  },

  // ========================= المذكرات =========================
  {
    key: "memos",
    title: "المذكرات",
    icon: "📝",
    permissions: [
      {
        key: "memo.write",
        label: "كتابة/إنشاء مذكرة",
        source: "write_memo — route memos POST",
        delegatable: true,
        roles: {
          system_admin: G,
          supervisor: { level: K, note: "لا أساس له — عبر تفويض write_memo فقط." },
          lawyer: { level: C, note: "المحامي المسؤول لقضيته؛ غيره عبر تفويض." },
          researcher: C,
          secretary: N,
          accountant: N,
        },
      },
      {
        key: "memo.review",
        label: "مراجعة/اعتماد/طلب تعديل المذكرة",
        source: "canReviewMemo (memos.ts) + canAccessCase",
        roles: {
          system_admin: G,
          supervisor: N,
          lawyer: { level: C, note: "المحامي فقط، على قضية يراها." },
          researcher: N,
          secretary: N,
          accountant: N,
        },
      },
      {
        key: "memo.editDraft",
        label: "تعديل المسودّة",
        source: "canEditMemo (memos.ts)",
        roles: {
          system_admin: G,
          supervisor: N,
          lawyer: { level: C, note: "إن كان كاتبها وهي draft/changes_requested." },
          researcher: { level: C, note: "كاتبها وهي draft/changes_requested." },
          secretary: N,
          accountant: N,
        },
      },
    ],
  },

  // ========================= الجلسة =========================
  {
    key: "session",
    title: "تقرير الجلسة والمحضر",
    icon: "🏛️",
    permissions: [
      {
        key: "session.report",
        label: "كتابة تقرير الجلسة",
        source: "canWriteSessionReport (sessionReport.ts)",
        roles: {
          system_admin: G,
          supervisor: { level: C, note: "إن كان من الحاضرين (مشرف/محامي الفريق)." },
          lawyer: { level: C, note: "المحامي المسؤول + محامو الفريق الحاضرون." },
          researcher: N,
          secretary: N,
          accountant: N,
        },
      },
      {
        key: "session.minutes",
        label: "تسجيل محضر الجلسة (يضبطها «انعقدت»)",
        source: "route sessions/[id]/minutes (attendingLawyerIds)",
        protectedRule: "لا يُغلق محضر جلسة منعقدة دون ربط مذكرة (ولو مسودّة).",
        roles: {
          system_admin: G,
          supervisor: { level: C, note: "من الحاضرين." },
          lawyer: { level: C, note: "المحامون الحاضرون." },
          researcher: N,
          secretary: N,
          accountant: N,
        },
      },
    ],
  },

  // ========================= التسلسل الزمني =========================
  {
    key: "timeline",
    title: "تسلسل الأحداث",
    icon: "🧭",
    permissions: [
      {
        key: "timeline.manage",
        label: "إدارة التسلسل الزمني للقضية",
        source: "manage_timeline — hasBaseCasePermission / route timeline",
        delegatable: true,
        roles: {
          system_admin: G,
          supervisor: { level: K, note: "لا أساس له — عبر تفويض manage_timeline." },
          lawyer: { level: C, note: "المحامي المسؤول أو مُنشئ القضية." },
          researcher: { level: K, note: "عبر تفويض manage_timeline." },
          secretary: N,
          accountant: N,
        },
      },
    ],
  },

  // ========================= التقييم (الاستلام) =========================
  {
    key: "intake",
    title: "التقييم (دراسة الاستلام)",
    icon: "📥",
    permissions: [
      {
        key: "intake.create",
        label: "إنشاء طلب استلام",
        source: "route intake POST (مصادقة فقط)",
        roles: { system_admin: G, supervisor: G, lawyer: G, researcher: G, secretary: G, accountant: G },
      },
      {
        key: "intake.assessSave",
        label: "حفظ دراسة التقييم",
        source: "canAccessIntake — route intake/[id]/assessment",
        roles: {
          system_admin: G,
          supervisor: G,
          lawyer: { level: C, note: "إن كان المستلِم أو المُفوَّض إليه." },
          researcher: { level: C, note: "إن كان المستلِم أو المُفوَّض إليه." },
          secretary: { level: C, note: "إن كان المستلِم أو المُفوَّض إليه." },
          accountant: { level: C, note: "إن كان المستلِم أو المُفوَّض إليه." },
        },
      },
      {
        key: "intake.assessApprove",
        label: "اعتماد التقييم",
        source: "canApproveAssessment (intake.ts)",
        protectedRule: "بوّابة إلزامية للتفعيل: لا تُفعّل قضية قبل اعتماد التقييم من مسؤول النظام (بعد تعبئة الحقول الإلزامية).",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "intake.decide",
        label: "قرار قبول/رفض + تفعيل القضية",
        source: "canDecideIntake / canActivateIntake (intake.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "intake.delegate",
        label: "تفويض التقييم لموظف",
        source: "canDelegateAssessment (intake.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "intake.rejectedBank",
        label: "الاطّلاع على بنك الرفضات",
        source: "canViewRejectedBank (intake.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
    ],
  },

  // ========================= صك الحكم والقطعية =========================
  {
    key: "verdict",
    title: "صك الحكم والقطعية",
    icon: "🔏",
    permissions: [
      {
        key: "verdict.write",
        label: "تسجيل صك حكم / تعديله",
        source: "canWriteVerdict (verdicts.ts)",
        delegatable: true,
        roles: {
          system_admin: G,
          supervisor: C,
          lawyer: C,
          researcher: { level: N, note: "ممنوع صراحةً من تسجيل الصكوك." },
          secretary: { level: C, note: "⚠️ يمرّ إن كان عضوًا في الفريق (edit_case) — راجع الملاحظات." },
          accountant: N,
        },
      },
      {
        key: "verdict.confirmFinality",
        label: "تأكيد اكتساب الحكم القطعية",
        source: "canWriteVerdict — route verdicts PATCH {confirmFinality}",
        delegatable: true,
        protectedRule: "منطق القطعية: الحكم الابتدائي «بانتظار القطعية» لا يُغلَق بحكم؛ الاكتساب يدوي أو باقتراح آلي بعد فوات مهلة الاستئناف (بلا إعلان تلقائي).",
        roles: {
          system_admin: G,
          supervisor: C,
          lawyer: C,
          researcher: { level: N, note: "ممنوع (نفس قاعدة تسجيل الصك)." },
          secretary: { level: C, note: "⚠️ يمرّ إن كان عضوًا في الفريق — راجع الملاحظات." },
          accountant: N,
        },
      },
    ],
  },

  // ========================= إدارة المستخدمين =========================
  {
    key: "users",
    title: "إدارة المستخدمين",
    icon: "🧑‍💼",
    permissions: [
      {
        key: "users.manage",
        label: "إضافة/تعديل/تعطيل المستخدمين وإعادة تعيين كلمات المرور",
        source: "canManageUsers (rbac.ts) — الصفحة + كل مسارات /api/users",
        protectedRule: "تعطيل ناعم لا حذف؛ بقاء مسؤول نظام نشط واحد على الأقل؛ لا تعطيل الذات؛ نقل القضايا النشطة عند التعطيل.",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "account.password",
        label: "تغيير كلمة المرور الذاتية",
        source: "route account/password (كل المستخدمين)",
        roles: { system_admin: G, supervisor: G, lawyer: G, researcher: G, secretary: G, accountant: G },
      },
    ],
  },

  // ========================= المستندات/العملاء/التقويم =========================
  {
    key: "docs",
    title: "المستندات والعملاء والتقويم",
    icon: "📂",
    permissions: [
      {
        key: "documents.upload",
        label: "رفع المستندات",
        source: "canUploadDocuments (rbac.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: G, researcher: G, secretary: G, accountant: N },
      },
      {
        key: "documents.view",
        label: "رؤية المستند",
        source: "canViewDocument (rbac.ts)",
        roles: {
          system_admin: { level: G, note: "يشمل مستندات «للشركاء فقط»." },
          supervisor: { level: C, note: "all_staff للجميع؛ المرتبط بقضية حسب رؤية القضية." },
          lawyer: C,
          researcher: C,
          secretary: C,
          accountant: C,
        },
      },
      {
        key: "clients.view",
        label: "رؤية العملاء",
        source: "clientVisibilityWhere (rbac.ts)",
        roles: {
          system_admin: { level: G, note: "كل العملاء." },
          supervisor: { level: C, note: "عملاء قضاياه المرئية." },
          lawyer: C,
          researcher: C,
          secretary: C,
          accountant: { level: G, note: "كل العملاء لأغراض الفوترة (دون تفاصيل القضايا)." },
        },
      },
      {
        key: "calendar.view",
        label: "التقويم والجلسات",
        source: "يتبع caseVisibilityWhere",
        roles: {
          system_admin: G,
          supervisor: C,
          lawyer: C,
          researcher: C,
          secretary: C,
          accountant: { level: N, note: "لا يرى القضايا/الجلسات." },
        },
      },
    ],
  },

  // ========================= أخرى =========================
  {
    key: "other",
    title: "المالية والإدارة والخدمات",
    icon: "⚙️",
    permissions: [
      {
        key: "audit.view",
        label: "سجل التدقيق",
        source: "canViewAuditLog (rbac.ts)",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "invoices.manage",
        label: "الفواتير والمصاريف",
        source: "canManageInvoices (rbac.ts)",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: G },
      },
      {
        key: "templates.manage",
        label: "إدارة النماذج",
        source: "canManageTemplates (rbac.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "caseflows.manage",
        label: "إدارة المسارات القضائية",
        source: "isManagement — /settings/case-flows",
        roles: { system_admin: G, supervisor: N, lawyer: N, researcher: N, secretary: N, accountant: N },
      },
      {
        key: "services.viewAll",
        label: "رؤية كل الخدمات القانونية",
        source: "serviceVisibility / canAccessService (services.ts)",
        roles: {
          system_admin: G,
          supervisor: G,
          lawyer: { level: C, note: "خدماته فقط." },
          researcher: { level: C, note: "خدماته فقط." },
          secretary: G,
          accountant: G,
        },
      },
      {
        key: "services.create",
        label: "إنشاء خدمة قانونية",
        source: "canCreateService (services.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: G, researcher: G, secretary: G, accountant: N },
      },
      {
        key: "services.fee",
        label: "إدارة أتعاب الخدمات",
        source: "canManageServiceFee (services.ts)",
        roles: { system_admin: G, supervisor: G, lawyer: N, researcher: N, secretary: N, accountant: G },
      },
    ],
  },
];

/** سلسلة التفويض (DELEGATION_CHAIN_RANK في rbac.ts) — للعرض في قسم التفويض. */
export const DELEGATION_CHAIN: { role: RoleKey; rank: number }[] = [
  { role: "system_admin", rank: 3 },
  { role: "supervisor", rank: 2 },
  { role: "lawyer", rank: 1 },
  { role: "researcher", rank: 1 },
  { role: "secretary", rank: 0 },
  { role: "accountant", rank: 0 },
];

/** الصلاحيات الخمس القابلة للتفويض وأساس مالكيها (DelegatedPermission). */
export const DELEGATABLE_PERMISSIONS: { key: string; label: string; base: string }[] = [
  { key: "edit_case", label: "تعديل القضية", base: "الجميع بوصول مباشر عدا المحاسب" },
  { key: "manage_team", label: "إدارة الفريق", base: "مسؤول النظام أو المشرف" },
  { key: "assign_tasks", label: "إسناد المهام", base: "مسؤول/مشرف/محامٍ/باحث" },
  { key: "write_memo", label: "كتابة المذكرات", base: "مسؤول النظام + الباحث + المحامي المسؤول للقضية" },
  { key: "manage_timeline", label: "إدارة التسلسل", base: "مسؤول النظام + المحامي المسؤول + مُنشئ القضية" },
];

/** استخراج قيمة موحّدة لخلية دور. */
export function roleCell(access: RoleAccess): { level: PermissionLevel | "none"; note?: string } {
  if (typeof access === "string") return { level: access };
  return { level: access.level, note: access.note };
}
