export type AutofillKey =
  | "clientName"
  | "clientNationalId"
  | "agencyNumber"
  | "clientPhone"
  | "caseNumber"
  | "caseTitle"
  | "lawyerName"
  | "dateHijriGregorian"
  | "weekday"
  | "courtName"
  | "courtCaseNumber"
  | "caseTypeLabel"
  | "plaintiffName"
  | "defendantName"
  | "clientPartyRole";

export type SimpleFieldType = "text" | "textarea" | "date" | "select";

export type TemplateField = {
  kind: "field";
  key: string;
  label: string;
  type: SimpleFieldType;
  options?: string[];
  autofill?: AutofillKey;
  half?: boolean;
};

export type TemplateMatrixColumn = {
  key: string;
  label: string;
  type: SimpleFieldType;
  options?: string[];
};

export type TemplateMatrix = {
  kind: "matrix";
  key: string;
  title: string;
  columns: TemplateMatrixColumn[];
  /** صفوف بعنوان ثابت (تُعرض كتسمية غير قابلة للتعديل)، أو صفوف مرقّمة فارغة إن كانت label = "" */
  rows: { key: string; label: string }[];
};

export type TemplateItem = TemplateField | TemplateMatrix;

export type TemplateCategory =
  | "case_progress"
  | "procedures"
  | "performance"
  | "governance";

export type TemplateLinkage = "case" | "case_optional" | "case_session" | "user" | "none";

export type TemplateDefinition = {
  key: string;
  name: string;
  category: TemplateCategory;
  description: string;
  linkedTo: TemplateLinkage;
  items: TemplateItem[];
  staticPdfPath?: string;
};

export const TEMPLATE_CATEGORY_LABELS_AR: Record<TemplateCategory, string> = {
  case_progress: "سير القضية",
  procedures: "إجراءات وتوثيق",
  performance: "تقارير الأداء",
  governance: "حوكمة داخلية",
};

export const TEMPLATE_CATEGORY_STYLES: Record<TemplateCategory, string> = {
  case_progress: "bg-taradhi/10 text-taradhi",
  procedures: "bg-gold/15 text-gold",
  performance: "bg-emerald-100 text-emerald-700",
  governance: "bg-purple-100 text-purple-700",
};

const FOLLOWUP_STEPS: { key: string; label: string }[] = [
  { key: "case_path", label: "تحديد مسار آلية القضية" },
  { key: "taradhi_session", label: "تقرير جلسة (تراضي – إن وجد)" },
  { key: "session_1", label: "تقرير جلسة رقم 1" },
  { key: "memo_1", label: "كتابة المذكرة رقم 1" },
  { key: "session_2", label: "تقرير جلسة رقم 2" },
  { key: "memo_2", label: "كتابة مذكرة رقم 2" },
  { key: "procedure_minutes", label: "محضر إجراء" },
  { key: "verdict", label: "صدور حكم" },
  { key: "verdict_objection", label: "الاعتراض على الحكم" },
];

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    key: "case_followup",
    name: "نموذج المتابعة سير القضية",
    category: "case_progress",
    description:
      "يهدف هذا النموذج إلى توثيق المسار الإجرائي للقضية منذ استلامها، لضمان وضوح الخطوات وتحديد المسؤوليات بدقة، وتفادي أي تأخير أو ازدواجية في الإجراءات.",
    linkedTo: "case",
    items: [
      { kind: "field", key: "clientName", label: "اسم الموكل", type: "text", autofill: "clientName" },
      { kind: "field", key: "nationalId", label: "رقم الهوية", type: "text", autofill: "clientNationalId", half: true },
      { kind: "field", key: "agencyNumber", label: "رقم الوكالة", type: "text", autofill: "agencyNumber", half: true },
      { kind: "field", key: "phone", label: "رقم الجوال", type: "text", autofill: "clientPhone" },
      {
        kind: "matrix",
        key: "procedures",
        title: "سير الإجراءات",
        columns: [
          { key: "statement", label: "البيان", type: "text" },
          { key: "date", label: "تاريخ الإجراء", type: "date" },
          { key: "responsible", label: "اسم مسؤول الإجراء", type: "text" },
        ],
        rows: FOLLOWUP_STEPS,
      },
    ],
  },
  {
    key: "case_path",
    name: "نموذج تحديد مسار آلية القضية",
    category: "case_progress",
    description:
      "يهدف هذا النموذج إلى توثيق البدء في الإجراء للمهمة، وتحديد المرحلة الحالية للقضية والتوجه الإجرائي لها.",
    linkedTo: "case",
    items: [
      { kind: "field", key: "date", label: "التاريخ", type: "text", autofill: "dateHijriGregorian" },
      {
        kind: "field",
        key: "taskType",
        label: "نوع المهمة",
        type: "select",
        options: ["خدمة قانونية", "قضية ابتدائية", "قضية استئناف"],
      },
      { kind: "field", key: "clientName", label: "اسم الموكل", type: "text", autofill: "clientName", half: true },
      { kind: "field", key: "roleInSubject", label: "صفة في الموضوع", type: "text", autofill: "clientPartyRole", half: true },
      { kind: "field", key: "nationalId", label: "رقم الهوية", type: "text", autofill: "clientNationalId", half: true },
      { kind: "field", key: "agencyNumber", label: "رقم الوكالة", type: "text", autofill: "agencyNumber", half: true },
      { kind: "field", key: "phone", label: "رقم الجوال", type: "text", autofill: "clientPhone" },
      { kind: "field", key: "generalClassification", label: "التصنيف العام", type: "text", half: true },
      { kind: "field", key: "subClassification", label: "التصنيف الفرعي", type: "text", half: true },
      { kind: "field", key: "facts", label: "الوقائع", type: "textarea" },
      { kind: "field", key: "evidence", label: "البينات والأسانيد", type: "textarea" },
      { kind: "field", key: "strengths", label: "نقاط القوة في القضية", type: "textarea" },
      { kind: "field", key: "weaknesses", label: "نقاط الضعف في القضية", type: "textarea" },
      { kind: "field", key: "notes", label: "ملاحظات واقتراحات بعد دراسة المسؤول", type: "textarea" },
      { kind: "field", key: "jurisdiction", label: "الاختصاص النوعي والمكاني", type: "text" },
      { kind: "field", key: "finalDirection", label: "التوجه النهائي", type: "text" },
    ],
  },
  {
    key: "case_analysis",
    name: "نموذج تحليل قضية / صك حكم",
    category: "case_progress",
    description:
      "يُستخدم هذا النموذج لإعداد تحليل مهني للقضية أو الحكم الصادر، بهدف تكوين رؤية قانونية واضحة قبل اتخاذ أي إجراء لاحق.",
    linkedTo: "case",
    items: [
      { kind: "field", key: "date", label: "التاريخ", type: "text", autofill: "dateHijriGregorian" },
      { kind: "field", key: "clientName", label: "اسم العميل", type: "text", autofill: "clientName", half: true },
      { kind: "field", key: "fileNumber", label: "رقم ملف العميل", type: "text", autofill: "caseNumber", half: true },
      { kind: "field", key: "facts", label: "الوقائع محل الدراسة", type: "textarea" },
      { kind: "field", key: "strengthsWeaknesses", label: "أوجه الضعف والقوة في الموضوع", type: "textarea" },
      { kind: "field", key: "generalOpinion", label: "الرأي العام", type: "textarea" },
      { kind: "field", key: "evidenceLaws", label: "الأدلة والأنظمة ذات الصلة", type: "textarea" },
      { kind: "field", key: "nextAction", label: "الإجراء القادم", type: "textarea" },
    ],
  },
  {
    key: "session_report",
    name: "تقرير الجلسة",
    category: "case_progress",
    description:
      "يُعد هذا النموذج لما دار في الجلسة القضائية، ويهدف إلى توثيق مجريات الجلسة بدقة لضمان استمرارية العمل دون فقدان أي معلومة.",
    linkedTo: "case_session",
    items: [
      { kind: "field", key: "weekday", label: "اليوم", type: "text", autofill: "weekday", half: true },
      { kind: "field", key: "date", label: "التاريخ", type: "text", autofill: "dateHijriGregorian", half: true },
      { kind: "field", key: "courtName", label: "المحكمة الناظرة للقضية", type: "text", autofill: "courtName", half: true },
      { kind: "field", key: "department", label: "الدائرة", type: "text", half: true },
      { kind: "field", key: "judgeName", label: "فضيلة القاضي", type: "text" },
      { kind: "field", key: "caseNumber", label: "رقم الدعوى", type: "text", autofill: "courtCaseNumber", half: true },
      { kind: "field", key: "caseClassification", label: "تصنيف القضية", type: "text", autofill: "caseTypeLabel", half: true },
      { kind: "field", key: "plaintiff", label: "المدعي", type: "text", autofill: "plaintiffName" },
      { kind: "field", key: "defendant", label: "المدعى عليه", type: "text", autofill: "defendantName" },
      { kind: "field", key: "sessionSummary", label: "ملخص الجلسة من قبل المحامي حاضر الجلسة", type: "textarea" },
      { kind: "field", key: "sessionNotes", label: "الملاحظات على ضبط الجلسة", type: "textarea" },
      { kind: "field", key: "proposedDirection", label: "توجه مقترح (أفكار مبدئية)", type: "textarea" },
      { kind: "field", key: "responsibleLawyer", label: "المحامي المسؤول", type: "text", autofill: "lawyerName" },
    ],
  },
  {
    key: "procedure_minutes",
    name: "نموذج محضر إجراء",
    category: "procedures",
    description:
      "يهدف هذا النموذج إلى توثيق أي إجراء إداري أو قانوني تم اتخاذه داخل المكتب، لضمان وجود سجل رسمي يمكن الرجوع إليه عند الحاجة.",
    linkedTo: "case_optional",
    items: [
      { kind: "field", key: "date", label: "التاريخ", type: "text", autofill: "dateHijriGregorian" },
      { kind: "field", key: "clientName", label: "أسم العميل", type: "text", autofill: "clientName" },
      { kind: "field", key: "caseNumber", label: "رقم القضية", type: "text", autofill: "caseNumber" },
      { kind: "field", key: "procedureType", label: "نوع الإجراء المتخذ", type: "textarea" },
      { kind: "field", key: "explanation", label: "الشرح", type: "textarea" },
      { kind: "field", key: "preparedBy", label: "معد المحضر", type: "text", autofill: "lawyerName" },
    ],
  },
  {
    key: "weekly_report",
    name: "التقرير الأسبوعي للأعمال",
    category: "performance",
    description:
      "يُستخدم هذا النموذج لمتابعة الأداء أسبوعيًا، وتوثيق الأعمال المنجزة والجارية والمتأخرة، بما يضمن وضوح سير العمل للإدارة.",
    linkedTo: "user",
    items: [
      { kind: "field", key: "name", label: "الاسم", type: "text", autofill: "lawyerName", half: true },
      { kind: "field", key: "date", label: "التاريخ", type: "text", autofill: "dateHijriGregorian", half: true },
      {
        kind: "matrix",
        key: "professional_work",
        title: "الأعمال المهنية",
        columns: [
          { key: "description", label: "شرح المهمة", type: "text" },
          { key: "status", label: "حالة المهمة", type: "select", options: ["تم الإنجاز", "تحت الإجراء"] },
        ],
        rows: Array.from({ length: 6 }, (_, i) => ({ key: `row_${i + 1}`, label: "" })),
      },
      {
        kind: "matrix",
        key: "research",
        title: "البحوث والدراسات",
        columns: [
          { key: "description", label: "شرح المهمة", type: "text" },
          { key: "status", label: "حالة المهمة", type: "select", options: ["تم الإنجاز", "تحت الإجراء"] },
        ],
        rows: Array.from({ length: 3 }, (_, i) => ({ key: `row_${i + 1}`, label: "" })),
      },
      {
        kind: "matrix",
        key: "reviews",
        title: "المراجعات",
        columns: [
          { key: "description", label: "شرح المهمة", type: "text" },
          { key: "status", label: "حالة المهمة", type: "select", options: ["تم الإنجاز", "تحت الإجراء"] },
        ],
        rows: Array.from({ length: 2 }, (_, i) => ({ key: `row_${i + 1}`, label: "" })),
      },
    ],
  },
  {
    key: "procedure_amendment",
    name: "نموذج اقتراح تعديل إجراء",
    category: "governance",
    description:
      "يتيح هذا النموذج للموظفين تقديم مقترحات تطويرية تتعلق بإجراءات العمل الداخلية، بهدف تحسين الكفاءة ورفع جودة الأداء.",
    linkedTo: "none",
    items: [
      { kind: "field", key: "date", label: "التاريخ", type: "text", autofill: "dateHijriGregorian" },
      {
        kind: "field",
        key: "procedureType",
        label: "نوع الإجراء (آلية جديدة – تطوير آلية)",
        type: "select",
        options: ["آلية جديدة", "تطوير آلية"],
      },
      { kind: "field", key: "currentProcedureName", label: "اسم الإجراء الحالي", type: "text", half: true },
      { kind: "field", key: "proposedProcedureName", label: "الاسم الآلية المقترحة", type: "text", half: true },
      { kind: "field", key: "previousMechanism", label: "الآلية السابقة", type: "textarea" },
      { kind: "field", key: "proposedMechanism", label: "الآلية المقترحة", type: "textarea" },
      { kind: "field", key: "goalSummary", label: "خلاصة الهدف من التطوير", type: "textarea" },
      { kind: "field", key: "submittedBy", label: "مقدم الاقتراح", type: "text", autofill: "lawyerName" },
    ],
  },
  {
    key: "approval_statement",
    name: "بيان اعتماد النماذج",
    category: "governance",
    description:
      "خطاب رسمي من إدارة الدراسات والتقاضي يعتمد النماذج الأساسية للعمل ويوضح آلية استخدامها لتوحيد منهجية العمل داخل المكتب.",
    linkedTo: "none",
    items: [],
    staticPdfPath: "/documents/بيان-اعتماد-النماذج.pdf",
  },
];

export function getTemplateDefinition(key: string): TemplateDefinition | undefined {
  return TEMPLATE_DEFINITIONS.find((t) => t.key === key);
}

/**
 * النماذج القابلة للتعبئة في مرحلة الاستلام (قبل إنشاء القضية):
 * النماذج التي لا تتطلّب قضية موجودة (`none` أو `case_optional`) وليست PDF ثابتًا.
 */
export function isIntakeEligibleTemplate(def: TemplateDefinition): boolean {
  return !def.staticPdfPath && (def.linkedTo === "none" || def.linkedTo === "case_optional");
}

export function getIntakeTemplates(): TemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter(isIntakeEligibleTemplate);
}
