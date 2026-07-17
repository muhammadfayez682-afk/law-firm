/**
 * قاموس التعريفات المركزي للحقول والمصطلحات القانونية الغامضة في النظام.
 *
 * الاستخدام في النماذج عبر `<DefinedField definitionKey="..." />`.
 * لإضافة تعريف جديد: أضِف مفتاحًا هنا (label + tooltip [+ example اختياري + category])
 * وسيتوفّر تلقائيًا في المكوّن وفي صفحة قاموس المصطلحات `/glossary`.
 */

export type FieldDefinitionCategory =
  | "intake"
  | "case"
  | "settlement"
  | "agency"
  | "memo"
  | "session"
  | "procedure"
  | "party"
  | "closure"
  | "conflict"
  | "template"
  | "task"
  | "billing";

export const FIELD_CATEGORY_LABELS_AR: Record<FieldDefinitionCategory, string> = {
  intake: "الاستلام",
  case: "القضايا",
  settlement: "التسوية والمنصات",
  agency: "الوكالة",
  memo: "المذكرات",
  session: "الجلسات",
  procedure: "الإجراءات",
  party: "الأطراف",
  closure: "الإغلاق والنتيجة",
  conflict: "تعارض المصالح",
  template: "النماذج",
  task: "المهام",
  billing: "الفوترة",
};

export const fieldDefinitions = {
  // === طلب الاستلام ===
  opposing_party: {
    label: "الطرف المقابل",
    tooltip:
      "الشخص أو الجهة التي بيننا وبينها نزاع أو خلاف قانوني. يُستخدم هذا الحقل لفحص تعارض المصالح تلقائياً — للتأكد أن هذا الطرف ليس عميلاً حالياً أو سابقاً لدينا.",
    example: "شركة النخبة للمقاولات، أو أحمد بن سعيد",
    category: "intake",
  },

  dispute_summary: {
    label: "ملخص النزاع",
    tooltip:
      "وصف موجز لطبيعة النزاع أو الطلب القانوني. اشرح: من الأطراف، ما موضوع النزاع، ومتى بدأ.",
    example: "مطالبة بمستحقات نهاية خدمة بعد إنهاء عقد العمل تعسفياً في 2026/03/15",
    category: "intake",
  },

  // === صفة الموكل ===
  client_party_role: {
    label: "صفة موكّلنا في الدعوى",
    tooltip:
      'دور موكّلنا القانوني: "مدعي" = نحن من رفعنا الدعوى ونطالب بحق. "مدعى عليه" = رُفعت علينا دعوى وندافع عن موكّلنا.',
    example: "مدعي (إذا كان عاملاً يطالب بحقوقه)، مدعى عليه (إذا كان صاحب عمل مطالَباً)",
    category: "case",
  },

  // === القضايا ===
  case_type: {
    label: "نوع القضية",
    tooltip: "التصنيف القانوني للنزاع، يحدد المحكمة المختصة والمسار القضائي المناسب.",
    category: "case",
  },

  internal_number: {
    label: "الرقم الداخلي",
    tooltip: "رقم مرجعي داخل نظام المكتب فقط. يبدأ بـ MZN ولا يظهر أمام المحكمة.",
    example: "MZN-2026-0007",
    category: "case",
  },

  court_case_number: {
    label: "رقم القضية بالمحكمة",
    tooltip:
      "الرقم الرسمي الصادر من المحكمة عند تسجيل الدعوى. يُستخدم في كل المخاطبات الرسمية.",
    example: "4568/ي-1447",
    category: "case",
  },

  // === التسوية والمنصات ===
  amicable_settlement: {
    label: "التسوية الودية",
    tooltip:
      "محاولة حل النزاع دون الذهاب للمحكمة. إلزامية في القضايا العمالية (عبر منصة قوى)، واختيارية في التجارية والأحوال الشخصية (عبر منصة تراضي).",
    category: "settlement",
  },

  qiwa_platform: {
    label: "منصة قوى",
    tooltip:
      "منصة تابعة لوزارة الموارد البشرية للتسوية الودية في القضايا العمالية. تسبق رفع الدعوى للمحكمة العمالية إلزامياً.",
    category: "settlement",
  },

  taradhi_platform: {
    label: "منصة تراضي",
    tooltip:
      "منصة تابعة لوزارة العدل للصلح في القضايا التجارية والمدنية والأحوال الشخصية.",
    category: "settlement",
  },

  // === الوكالة ===
  agency: {
    label: "الوكالة الشرعية",
    tooltip:
      "وثيقة رسمية تخوّل المحامي التصرف نيابة عن الموكل أمام المحاكم والجهات الرسمية. عادة تُصدَر عبر منصة ناجز.",
    category: "agency",
  },

  agency_scope: {
    label: "نطاق الوكالة",
    tooltip:
      "حدود صلاحيات الوكالة: عامة (تشمل كل الأمور القانونية) أو خاصة (لقضية أو موضوع محدد).",
    category: "agency",
  },

  // === المذكرات ===
  legal_memo: {
    label: "المذكرة القانونية",
    tooltip:
      "وثيقة قانونية مكتوبة تُقدَّم للمحكمة. يكتبها الباحث القانوني ويعتمدها المحامي قبل تقديمها. تحتوي على: الوقائع، الأسانيد النظامية، السوابق القضائية، والمطلوب.",
    category: "memo",
  },

  memo_defense: {
    label: "مذكرة دفاع",
    tooltip:
      "مذكرة يقدمها المدعى عليه للرد على دعوى مرفوعة ضده، تتضمن الدفوع والحجج القانونية.",
    category: "memo",
  },

  memo_response: {
    label: "مذكرة رد",
    tooltip: "مذكرة تُقدَّم رداً على مذكرة الطرف الآخر.",
    category: "memo",
  },

  memo_appeal: {
    label: "لائحة اعتراض / استئناف",
    tooltip: "مذكرة تُقدَّم للاعتراض على حكم صادر ونقله لمحكمة أعلى.",
    category: "memo",
  },

  // === الجلسات ===
  session_hearing: {
    label: "جلسة مرافعة",
    tooltip: "جلسة يقدّم فيها المحامي حججه شفهياً أمام القاضي ويناقش الأدلة.",
    category: "session",
  },

  session_verdict: {
    label: "جلسة نطق بالحكم",
    tooltip: "الجلسة التي يُنطق فيها الحكم النهائي في القضية.",
    category: "session",
  },

  session_initial: {
    label: "جلسة استماع أولي",
    tooltip: "أول جلسة في القضية، يُستمَع فيها للأطراف ويُحدَّد مسار الدعوى.",
    category: "session",
  },

  // === الإجراءات ===
  procedure_minutes: {
    label: "محضر إجراء",
    tooltip:
      "توثيق مكتوب لإجراء تم اتخاذه في القضية: اجتماع، مكالمة، تسليم مستند، أو أي إجراء إداري أو قانوني.",
    category: "procedure",
  },

  case_path: {
    label: "تحديد مسار القضية",
    tooltip:
      "الاستراتيجية القانونية العامة للقضية: كيف نتعامل معها، والاختصاص القضائي، والتوجه النهائي.",
    category: "procedure",
  },

  // === الأطراف ===
  plaintiff: {
    label: "المدعي",
    tooltip: "الطرف الذي رفع الدعوى ويطالب بحق.",
    category: "party",
  },

  defendant: {
    label: "المدعى عليه",
    tooltip: "الطرف الذي رُفعت عليه الدعوى.",
    category: "party",
  },

  third_party: {
    label: "طرف ثالث",
    tooltip: "شخص أو جهة لها مصلحة في القضية ودخلت لاحقاً كمتدخل أو مدخَل.",
    category: "party",
  },

  // === الإغلاق ===
  case_closure: {
    label: "إغلاق القضية",
    tooltip:
      "إنهاء العمل على القضية بشكل رسمي بعد صدور حكم نهائي أو تسوية. يتطلب طلب من المحامي واعتماد من مسؤول النظام.",
    category: "closure",
  },

  case_outcome: {
    label: "نتيجة القضية",
    tooltip:
      "الحكم النهائي: كسب كامل (كل المطالب)، كسب جزئي (بعض المطالب)، خسارة، صلح، سحب، أو رد شكلي.",
    category: "closure",
  },

  // === تعارض المصالح ===
  conflict_check: {
    label: "فحص تعارض المصالح",
    tooltip:
      "التحقق من عدم وجود ارتباط قانوني أو مصلحة سابقة تمنعنا من تمثيل هذا العميل. مثلاً: أن يكون الطرف المقابل عميلاً حالياً أو سابقاً لدينا.",
    category: "conflict",
  },

  conflict_confirmed: {
    label: "تعارض مؤكد",
    tooltip:
      "تعارض مصالح مؤكد قانونياً — لا يجوز قبول القضية إلا بإذن مسؤول النظام وتوثيق واضح للسبب.",
    category: "conflict",
  },

  // === النماذج ===
  case_followup: {
    label: "نموذج متابعة سير القضية",
    tooltip:
      "يوثّق كل إجراء تم في القضية زمنياً — يساعد في تتبع مراحل العمل ومسؤول كل إجراء.",
    category: "template",
  },

  case_analysis: {
    label: "نموذج تحليل قضية",
    tooltip:
      "دراسة قانونية معمّقة للقضية أو الحكم — الوقائع، الأدلة، نقاط القوة والضعف، والتوصية القانونية.",
    category: "template",
  },

  session_report: {
    label: "تقرير الجلسة",
    tooltip:
      "توثيق ما دار في الجلسة القضائية: القاضي، الأطراف، ملخص المرافعات، وأي توجه مقترح.",
    category: "template",
  },

  weekly_report: {
    label: "التقرير الأسبوعي",
    tooltip:
      "تقرير أسبوعي لأداء الموظف: المهام المنجزة، قيد التنفيذ، والمتأخرة مع أسبابها.",
    category: "template",
  },

  // === المهام ===
  task_priority: {
    label: "أولوية المهمة",
    tooltip:
      "عاجل: يجب إنجازها اليوم. عالي: خلال 3 أيام. عادي: خلال أسبوع. منخفض: بدون موعد صارم.",
    category: "task",
  },

  // === الفوترة ===
  vat: {
    label: "ضريبة القيمة المضافة",
    tooltip:
      "ضريبة القيمة المضافة (15%) — تُضاف على الأتعاب والخدمات القانونية حسب نظام ZATCA.",
    category: "billing",
  },
} as const satisfies Record<
  string,
  { label: string; tooltip: string; example?: string; category: FieldDefinitionCategory }
>;

export type FieldDefinitionKey = keyof typeof fieldDefinitions;
