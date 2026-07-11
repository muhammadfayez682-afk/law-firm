import { PrismaClient } from "@prisma/client";
import type { CaseType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Admin1234", 10);

  const sara = await prisma.user.upsert({
    where: { email: "sara@lawfirm.com" },
    update: {},
    create: {
      fullName: "سارة القدوم",
      email: "sara@lawfirm.com",
      password: passwordHash,
      phone: "0501234567",
      role: "partner",
    },
  });

  const khalid = await prisma.user.upsert({
    where: { email: "khalid@lawfirm.com" },
    update: {},
    create: {
      fullName: "خالد المطيري",
      email: "khalid@lawfirm.com",
      password: passwordHash,
      phone: "0559876543",
      role: "lawyer",
    },
  });

  const individualClient = await prisma.client.upsert({
    where: { nationalIdOrCr: "1023456789" },
    update: {},
    create: {
      type: "individual",
      fullName: "عبدالله بن سعيد الحربي",
      nationalIdOrCr: "1023456789",
      nationality: "سعودي",
      phone: "0561112233",
      email: "abdullah.harbi@example.com",
      status: "active",
    },
  });

  const companyClientOne = await prisma.client.upsert({
    where: { nationalIdOrCr: "7001112223" },
    update: {},
    create: {
      type: "company",
      fullName: "شركة الأفق للمقاولات",
      nationalIdOrCr: "7001112223",
      representativeName: "ماجد بن فهد العتيبي",
      phone: "0114455667",
      email: "info@alofoq-contracting.com",
      status: "active",
    },
  });

  const companyClientTwo = await prisma.client.upsert({
    where: { nationalIdOrCr: "7004445556" },
    update: {},
    create: {
      type: "company",
      fullName: "مؤسسة النخبة للتجارة العامة",
      nationalIdOrCr: "7004445556",
      representativeName: "نورة بنت خالد السبيعي",
      phone: "0126677889",
      email: "contact@alnukhba-trading.com",
      status: "prospect",
    },
  });

  const commercialCase = await prisma.case.upsert({
    where: { internalNumber: "MZN-2026-0001" },
    update: {},
    create: {
      internalNumber: "MZN-2026-0001",
      courtCaseNumber: "44512300",
      title: "نزاع تجاري - إخلال بعقد مقاولة",
      caseType: "commercial",
      courtName: "المحكمة التجارية بالرياض",
      claimValue: 850000,
      clientId: companyClientOne.id,
      status: "in_progress",
      responsibleLawyerId: sara.id,
      priority: "high",
      conflictCheckConfirmed: true,
      notes: "مطالبة بتعويض عن تأخير تسليم المشروع.",
      parties: {
        create: [
          { role: "plaintiff", name: "شركة الأفق للمقاولات", linkedClientId: companyClientOne.id },
          { role: "defendant", name: "مؤسسة البناء الحديث" },
        ],
      },
      team: {
        create: [{ userId: sara.id, roleInCase: "lead" }],
      },
    },
  });

  const laborCase = await prisma.case.upsert({
    where: { internalNumber: "MZN-2026-0002" },
    update: {},
    create: {
      internalNumber: "MZN-2026-0002",
      title: "قضية عمالية - مستحقات نهاية خدمة",
      caseType: "labor",
      courtName: "المحكمة العمالية بجدة",
      claimValue: 45000,
      clientId: individualClient.id,
      status: "amicable_settlement",
      responsibleLawyerId: khalid.id,
      priority: "normal",
      conflictCheckConfirmed: true,
      notes: "قضية مطالبة بمستحقات نهاية الخدمة والإجازات المتراكمة.",
      parties: {
        create: [
          { role: "plaintiff", name: "عبدالله بن سعيد الحربي", linkedClientId: individualClient.id },
          { role: "defendant", name: "مؤسسة النخبة للتجارة العامة", linkedClientId: companyClientTwo.id },
        ],
      },
      team: {
        create: [{ userId: khalid.id, roleInCase: "lead" }],
      },
    },
  });

  // upsert منفصل (بدل متداخل) لضمان إنشاء التسوية حتى لو كانت القضية موجودة مسبقًا من seed سابق.
  await prisma.amicableSettlement.upsert({
    where: { caseId: laborCase.id },
    update: {},
    create: {
      caseId: laborCase.id,
      platform: "qiwa",
      isMandatory: true,
      requestNumber: "QIWA-991827",
      firstSessionDate: new Date("2026-08-05T10:00:00.000Z"),
      deadlineDate: new Date("2026-08-15T00:00:00.000Z"),
      mediatorName: "أحمد بن يوسف القرني",
      outcome: "pending",
    },
  });

  const commercialTaradhiCase = await prisma.case.upsert({
    where: { internalNumber: "MZN-2026-0005" },
    update: {},
    create: {
      internalNumber: "MZN-2026-0005",
      title: "نزاع تجاري - خلاف شراكة",
      caseType: "commercial",
      courtName: "المحكمة التجارية بجدة",
      claimValue: 320000,
      clientId: companyClientTwo.id,
      status: "amicable_settlement",
      responsibleLawyerId: sara.id,
      priority: "normal",
      conflictCheckConfirmed: true,
      notes: "نزاع بين شريكين حول توزيع الأرباح، يُنظر عبر منصة تراضي قبل رفع الدعوى.",
      parties: {
        create: [
          { role: "plaintiff", name: "مؤسسة النخبة للتجارة العامة", linkedClientId: companyClientTwo.id },
          { role: "defendant", name: "الشريك السابق - محمد العنزي" },
        ],
      },
      team: {
        create: [{ userId: sara.id, roleInCase: "lead" }],
      },
    },
  });

  await prisma.amicableSettlement.upsert({
    where: { caseId: commercialTaradhiCase.id },
    update: {},
    create: {
      caseId: commercialTaradhiCase.id,
      platform: "taradhi",
      isMandatory: false,
      requestNumber: "TRD-552104",
      firstSessionDate: new Date("2026-07-28T11:00:00.000Z"),
      mediatorName: "منى بنت خالد الشهري",
      outcome: "pending",
    },
  });

  const personalStatusCase = await prisma.case.upsert({
    where: { internalNumber: "MZN-2026-0003" },
    update: {},
    create: {
      internalNumber: "MZN-2026-0003",
      title: "أحوال شخصية - دعوى نفقة",
      caseType: "personal_status",
      courtName: "محكمة الأحوال الشخصية بالدمام",
      clientId: individualClient.id,
      status: "open",
      responsibleLawyerId: sara.id,
      priority: "urgent",
      conflictCheckConfirmed: true,
      notes: "دعوى نفقة زوجة وأبناء.",
      parties: {
        create: [
          { role: "plaintiff", name: "عبدالله بن سعيد الحربي", linkedClientId: individualClient.id },
        ],
      },
      team: {
        create: [{ userId: sara.id, roleInCase: "lead" }],
      },
    },
  });

  const templatesSeed = [
    {
      name: "عقد أتعاب محاماة",
      category: "contract" as const,
      applicableCaseTypes: ["commercial", "labor", "personal_status", "other"] as const,
      content:
        "عقد أتعاب محاماة\n\nأبرم هذا العقد بتاريخ {{date}} بين مكتب قدوم الحقائق للمحاماة والاستشارات القانونية، ويمثله المحامي {{lawyerName}}، وبين العميل {{clientName}}.\n\nيتعلق هذا العقد بالقضية: {{caseTitle}}.\n\nاتفق الطرفان على أتعاب قدرها {{feeAmount}} ريال سعودي، تُدفع وفق الشروط المتفق عليها بين الطرفين.\n\nوالله ولي التوفيق.",
      placeholders: [
        { key: "clientName", label: "اسم العميل", type: "text" },
        { key: "caseTitle", label: "موضوع القضية", type: "text" },
        { key: "feeAmount", label: "قيمة الأتعاب (ريال)", type: "text" },
        { key: "lawyerName", label: "اسم المحامي", type: "text", autofill: "currentUserName" },
        { key: "date", label: "التاريخ", type: "date", autofill: "currentDate" },
      ],
    },
    {
      name: "إنذار قانوني",
      category: "judicial" as const,
      applicableCaseTypes: ["commercial", "debt_collection", "other"] as const,
      content:
        "إنذار قانوني\n\nالتاريخ: {{date}}\n\nإلى: {{recipientName}}\n\nالموضوع: {{subject}}\n\n{{body}}\n\nوعليه، فإننا ننذركم بضرورة الاستجابة خلال المدة النظامية، وإلا سنضطر آسفين لاتخاذ الإجراءات القانونية اللازمة لحفظ حقوق موكلنا.\n\nالمحامي: {{lawyerName}}",
      placeholders: [
        { key: "recipientName", label: "اسم المرسل إليه", type: "text" },
        { key: "subject", label: "الموضوع", type: "text" },
        { key: "body", label: "نص الإنذار", type: "textarea" },
        { key: "lawyerName", label: "اسم المحامي", type: "text", autofill: "currentUserName" },
        { key: "date", label: "التاريخ", type: "date", autofill: "currentDate" },
      ],
    },
    {
      name: "محضر تسوية ودية",
      category: "settlement" as const,
      applicableCaseTypes: ["labor", "commercial"] as const,
      content:
        "محضر تسوية ودية\n\nبتاريخ {{date}}، تم الاتفاق بين {{clientName}} والطرف الآخر {{opposingParty}} على تسوية النزاع وديًا.\n\nتفاصيل التسوية: {{settlementDetails}}\n\nقيمة التسوية (إن وجدت): {{settlementAmount}} ريال سعودي.\n\nحرر هذا المحضر بحضور المحامي {{lawyerName}} ويُعد سندًا بين الطرفين.",
      placeholders: [
        { key: "clientName", label: "اسم العميل", type: "text" },
        { key: "opposingParty", label: "الطرف الآخر", type: "text" },
        { key: "settlementDetails", label: "تفاصيل التسوية", type: "textarea" },
        { key: "settlementAmount", label: "قيمة التسوية (ريال)", type: "text" },
        { key: "lawyerName", label: "اسم المحامي", type: "text", autofill: "currentUserName" },
        { key: "date", label: "التاريخ", type: "date", autofill: "currentDate" },
      ],
    },
  ];

  for (const t of templatesSeed) {
    const existing = await prisma.template.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.template.create({
        data: {
          name: t.name,
          category: t.category,
          applicableCaseTypes: [...t.applicableCaseTypes],
          content: t.content,
          placeholders: t.placeholders,
          createdById: sara.id,
        },
      });
    }
  }

  type StageTemplate = {
    key: string;
    labelAr: string;
    isMandatory: boolean;
    authority?: string;
    platformUrl?: string;
  };

  const generalCourtStages: StageTemplate[] = [
    {
      key: "settlement",
      labelAr: "الصلح (تراضي)",
      isMandatory: false,
      authority: "منصة تراضي — وزارة العدل",
      platformUrl: "https://taradhi.moj.gov.sa",
    },
    { key: "first_instance", labelAr: "المحكمة الابتدائية", isMandatory: true },
    { key: "appeal", labelAr: "محكمة الاستئناف", isMandatory: false },
    { key: "supreme", labelAr: "المحكمة العليا", isMandatory: false },
  ];

  const laborStages: StageTemplate[] = [
    {
      key: "settlement",
      labelAr: "التسوية الودية",
      isMandatory: true,
      authority: "منصة قوى — وزارة الموارد البشرية",
      platformUrl: "https://qiwa.sa",
    },
    { key: "first_instance", labelAr: "المحكمة العمالية الابتدائية", isMandatory: true },
    { key: "appeal", labelAr: "محكمة الاستئناف", isMandatory: false },
    { key: "supreme", labelAr: "المحكمة العليا", isMandatory: false },
  ];

  const administrativeStages: StageTemplate[] = [
    {
      key: "grievance",
      labelAr: "التظلم للجهة الإدارية (إلزامي في القرارات الوظيفية فقط)",
      isMandatory: false,
      authority: "ديوان المظالم",
    },
    { key: "first_instance", labelAr: "المحكمة الإدارية الابتدائية", isMandatory: true },
    { key: "appeal", labelAr: "محكمة الاستئناف الإدارية", isMandatory: false },
    { key: "supreme", labelAr: "المحكمة الإدارية العليا", isMandatory: false },
  ];

  const committeeStages: StageTemplate[] = [
    { key: "filing", labelAr: "رفع الدعوى لدى اللجنة", isMandatory: true },
    { key: "first_instance", labelAr: "اللجنة الابتدائية", isMandatory: true },
    { key: "appeal", labelAr: "اللجنة الاستئنافية", isMandatory: false },
  ];

  const caseFlowSeed: { caseType: CaseType; stages: StageTemplate[] }[] = [
    { caseType: "general", stages: generalCourtStages },
    { caseType: "commercial", stages: generalCourtStages },
    { caseType: "personal_status", stages: generalCourtStages },
    { caseType: "debt_collection", stages: generalCourtStages },
    { caseType: "labor", stages: laborStages },
    { caseType: "administrative", stages: administrativeStages },
    { caseType: "committee", stages: committeeStages },
  ];

  for (const group of caseFlowSeed) {
    for (let i = 0; i < group.stages.length; i++) {
      const stage = group.stages[i];
      await prisma.caseFlowStage.upsert({
        where: { caseType_order: { caseType: group.caseType, order: i + 1 } },
        update: {},
        create: {
          caseType: group.caseType,
          order: i + 1,
          key: stage.key,
          labelAr: stage.labelAr,
          isMandatory: stage.isMandatory,
          authority: stage.authority ?? null,
          platformUrl: stage.platformUrl ?? null,
        },
      });
    }
  }

  console.log("تمت تعبئة البيانات التجريبية بنجاح:");
  console.log({
    users: [sara.email, khalid.email],
    clients: [individualClient.fullName, companyClientOne.fullName, companyClientTwo.fullName],
    cases: [
      commercialCase.internalNumber,
      laborCase.internalNumber,
      personalStatusCase.internalNumber,
      commercialTaradhiCase.internalNumber,
    ],
    templates: templatesSeed.map((t) => t.name),
    caseFlowStages: caseFlowSeed.reduce((sum, g) => sum + g.stages.length, 0),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
