import { PrismaClient } from "@prisma/client";
import type { CaseType, PartyRole, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Test1234", 10);

  const userSeed = [
    { fullName: "أنس الغامدي", email: "anas@qudum.sa", phone: "0500000001", role: "system_admin" as const },
    { fullName: "عبدالرحمن الزهراني", email: "abdulrahman@qudum.sa", phone: "0500000002", role: "system_admin" as const },
    { fullName: "لمياء البردي", email: "lamia@qudum.sa", phone: "0500000003", role: "lawyer" as const },
    { fullName: "سحر السالمي", email: "sahar@qudum.sa", phone: "0500000004", role: "lawyer" as const },
    { fullName: "عمر الثمالي", email: "omar@qudum.sa", phone: "0500000005", role: "lawyer" as const },
    { fullName: "سلطان النمري", email: "sultan@qudum.sa", phone: "0500000006", role: "researcher" as const },
    { fullName: "يزيد الغامدي", email: "yazid@qudum.sa", phone: "0500000007", role: "researcher" as const },
  ];

  const users: Record<string, { id: string; email: string }> = {};
  for (const u of userSeed) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        fullName: u.fullName,
        email: u.email,
        password: passwordHash,
        phone: u.phone,
        role: u.role,
      },
    });
    users[u.email] = created;
  }

  const anas = users["anas@qudum.sa"];
  const abdulrahman = users["abdulrahman@qudum.sa"];
  const lamia = users["lamia@qudum.sa"];
  const sahar = users["sahar@qudum.sa"];
  const omar = users["omar@qudum.sa"];
  const sultan = users["sultan@qudum.sa"];
  const yazid = users["yazid@qudum.sa"];

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
      responsibleLawyerId: lamia.id,
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
        create: [
          { userId: anas.id, roleInCase: "supervisor" },
          { userId: lamia.id, roleInCase: "lawyer" },
          { userId: sultan.id, roleInCase: "researcher" },
        ],
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
      responsibleLawyerId: sahar.id,
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
        create: [
          { userId: abdulrahman.id, roleInCase: "supervisor" },
          { userId: sahar.id, roleInCase: "lawyer" },
          { userId: yazid.id, roleInCase: "researcher" },
        ],
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
      responsibleLawyerId: omar.id,
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
        create: [
          { userId: anas.id, roleInCase: "supervisor" },
          { userId: omar.id, roleInCase: "lawyer" },
          { userId: sultan.id, roleInCase: "researcher" },
        ],
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
      responsibleLawyerId: lamia.id,
      priority: "urgent",
      conflictCheckConfirmed: true,
      notes: "دعوى نفقة زوجة وأبناء.",
      parties: {
        create: [
          { role: "plaintiff", name: "عبدالله بن سعيد الحربي", linkedClientId: individualClient.id },
        ],
      },
      team: {
        create: [
          { userId: abdulrahman.id, roleInCase: "supervisor" },
          { userId: lamia.id, roleInCase: "lawyer" },
          { userId: yazid.id, roleInCase: "researcher" },
        ],
      },
    },
  });

  // أطراف الدعوى + صفة موكّلنا — تُعاد بناؤها بشكل idempotent (حذف ثم إنشاء)
  // ليعمل reseed دون reset، مع تنويع: بعضها نحن مدّعون وبعضها مدّعى عليهم.
  type SeedParty = {
    role: PartyRole;
    name: string;
    identityNumber?: string | null;
    opposingCounsel?: string | null;
  };
  const partySeed: {
    caseId: string;
    clientRole: PartyRole;
    ourName: string;
    ourClientId: string;
    opposing: SeedParty[];
  }[] = [
    {
      caseId: commercialCase.id,
      clientRole: "plaintiff",
      ourName: companyClientOne.fullName,
      ourClientId: companyClientOne.id,
      opposing: [
        { role: "defendant", name: "مؤسسة البناء الحديث", opposingCounsel: "المحامي فهد الدوسري" },
      ],
    },
    {
      caseId: laborCase.id,
      clientRole: "plaintiff",
      ourName: individualClient.fullName,
      ourClientId: individualClient.id,
      opposing: [
        { role: "defendant", name: "مؤسسة النخبة للتجارة العامة", identityNumber: "7004445556" },
      ],
    },
    {
      caseId: personalStatusCase.id,
      clientRole: "plaintiff",
      ourName: individualClient.fullName,
      ourClientId: individualClient.id,
      opposing: [{ role: "defendant", name: "المدعى عليها (الزوجة)" }],
    },
    {
      // للتنويع: هنا موكّلنا مدّعى عليه.
      caseId: commercialTaradhiCase.id,
      clientRole: "defendant",
      ourName: companyClientTwo.fullName,
      ourClientId: companyClientTwo.id,
      opposing: [
        {
          role: "plaintiff",
          name: "الشريك السابق - محمد العنزي",
          opposingCounsel: "المحامية سارة القحطاني",
        },
      ],
    },
  ];

  for (const p of partySeed) {
    await prisma.caseParty.deleteMany({ where: { caseId: p.caseId } });
    await prisma.case.update({
      where: { id: p.caseId },
      data: { clientPartyRole: p.clientRole },
    });
    await prisma.caseParty.create({
      data: {
        caseId: p.caseId,
        role: p.clientRole,
        name: p.ourName,
        isOurClient: true,
        linkedClientId: p.ourClientId,
      },
    });
    for (const o of p.opposing) {
      await prisma.caseParty.create({
        data: {
          caseId: p.caseId,
          role: o.role,
          name: o.name,
          identityNumber: o.identityNumber ?? null,
          opposingCounsel: o.opposingCounsel ?? null,
          isOurClient: false,
        },
      });
    }
  }

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
          createdById: anas.id,
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

  // مذكرات تجريبية لتفعيل سير اعتماد المذكرات.
  const memoSeed = [
    {
      caseId: commercialCase.id,
      title: "مذكرة دفاع أولية — نزاع المقاولة",
      memoType: "مذكرة دفاع",
      content:
        "تتلخص وقائع الدعوى في مطالبة موكلنا بالتعويض عن تأخر تسليم المشروع...\n\nنلتمس من الدائرة الموقّرة رد دعوى المدعى عليه للأسباب الآتية:",
      legalBasis: "نظام المعاملات المدنية، المواد المنظّمة لعقود المقاولة.",
      precedents: "حكم المحكمة التجارية رقم 44xxxxx القاضي بأحقية التعويض عند التأخر.",
      circulars: null,
      status: "submitted" as const,
      authoredById: sultan.id,
    },
    {
      caseId: laborCase.id,
      title: "مذكرة رد على لائحة المدعى عليه",
      memoType: "مذكرة رد",
      content: "رداً على ما ورد في لائحة المدعى عليه، نفيد بما يلي...",
      legalBasis: "نظام العمل، أحكام مكافأة نهاية الخدمة.",
      precedents: null,
      circulars: null,
      status: "draft" as const,
      authoredById: yazid.id,
    },
  ];

  for (const m of memoSeed) {
    const existing = await prisma.legalMemo.findFirst({
      where: { caseId: m.caseId, title: m.title },
    });
    if (!existing) {
      await prisma.legalMemo.create({ data: m });
    }
  }

  // طلبات استلام تجريبية: 2 مقبولة (مربوطة بقضايا)، 1 قيد تقييم، 1 بانتظار عقد، 1 مرفوضة.
  const intakeSeed: Prisma.IntakeRequestCreateInput[] = [
    {
      requestNumber: "INT-2026-0001",
      clientName: "شركة الأفق للمقاولات",
      clientPhone: "0114455667",
      disputeSummary: "نزاع تجاري حول إخلال بعقد مقاولة وتأخر تسليم مشروع كبير مع مطالبة بالتعويض.",
      opposingParty: "مؤسسة البناء الحديث",
      proposedType: "commercial",
      source: "referral_client",
      receivedBy: { connect: { id: anas.id } },
      status: "accepted",
      conflictResult: "clear",
      conflictNotes: "لا يوجد تعارض مصالح",
      conflictCheckedAt: new Date("2026-05-01T09:00:00.000Z"),
      assessmentBy: { connect: { id: anas.id } },
      legalBasis: "نظام المعاملات المدنية — عقود المقاولة",
      proposedFee: 60000,
      assessedAt: new Date("2026-05-03T09:00:00.000Z"),
      decision: "accepted",
      decisionBy: { connect: { id: anas.id } },
      decisionAt: new Date("2026-05-04T09:00:00.000Z"),
      feeAgreementSignedAt: new Date("2026-05-05T09:00:00.000Z"),
      advancePaymentReceived: true,
      case: { connect: { id: commercialCase.id } },
    },
    {
      requestNumber: "INT-2026-0002",
      clientName: "عبدالله بن سعيد الحربي",
      clientPhone: "0561112233",
      disputeSummary: "مطالبة عمالية بمستحقات نهاية الخدمة والإجازات المتراكمة بعد إنهاء غير مشروع.",
      opposingParty: "مؤسسة النخبة للتجارة العامة",
      proposedType: "labor",
      source: "walk_in",
      receivedBy: { connect: { id: abdulrahman.id } },
      status: "accepted",
      conflictResult: "clear",
      conflictNotes: "لا يوجد تعارض مصالح",
      conflictCheckedAt: new Date("2026-05-10T09:00:00.000Z"),
      assessmentBy: { connect: { id: anas.id } },
      proposedFee: 15000,
      assessedAt: new Date("2026-05-11T09:00:00.000Z"),
      decision: "accepted",
      decisionBy: { connect: { id: anas.id } },
      decisionAt: new Date("2026-05-12T09:00:00.000Z"),
      feeAgreementSignedAt: new Date("2026-05-13T09:00:00.000Z"),
      advancePaymentReceived: true,
      case: { connect: { id: laborCase.id } },
    },
    {
      requestNumber: "INT-2026-0003",
      clientName: "مؤسسة الريادة الطبية",
      clientPhone: "0509988776",
      clientEmail: "info@riada-medical.example.com",
      disputeSummary: "نزاع حول توريد أجهزة طبية معيبة والمطالبة بفسخ العقد واسترداد المبالغ المدفوعة.",
      opposingParty: "شركة التقنية للتجهيزات",
      proposedType: "commercial",
      source: "website",
      receivedBy: { connect: { id: lamia.id } },
      status: "under_assessment",
      conflictResult: "clear",
      conflictNotes: "لا يوجد تعارض مصالح",
      conflictCheckedAt: new Date("2026-06-20T09:00:00.000Z"),
      assessmentBy: { connect: { id: anas.id } },
      legalBasis: "أحكام ضمان العيوب الخفية",
      assessedAt: new Date("2026-06-21T09:00:00.000Z"),
    },
    {
      requestNumber: "INT-2026-0004",
      clientName: "سعد بن ناصر القحطاني",
      clientPhone: "0533221100",
      clientIdNumber: "1055667788",
      disputeSummary: "دعوى مطالبة مالية بقيمة دين مستحق موثّق بسند لأمر لم يُسدَّد في موعده.",
      opposingParty: "فيصل بن سعود الدوسري",
      proposedType: "debt_collection",
      source: "personal_network",
      receivedBy: { connect: { id: sahar.id } },
      status: "fee_agreement_pending",
      conflictResult: "clear",
      conflictNotes: "لا يوجد تعارض مصالح",
      conflictCheckedAt: new Date("2026-07-01T09:00:00.000Z"),
      assessmentBy: { connect: { id: anas.id } },
      proposedFee: 8000,
      assessedAt: new Date("2026-07-02T09:00:00.000Z"),
      decision: "accepted",
      decisionBy: { connect: { id: anas.id } },
      decisionAt: new Date("2026-07-03T09:00:00.000Z"),
    },
    {
      requestNumber: "INT-2026-0005",
      clientName: "خالد بن عبدالعزيز",
      clientPhone: "0577665544",
      disputeSummary: "طلب تمثيل في نزاع تجاري ضد أحد عملاء المكتب الحاليين مما يثير تعارض مصالح.",
      opposingParty: "شركة الأفق للمقاولات",
      proposedType: "commercial",
      source: "advertisement",
      receivedBy: { connect: { id: omar.id } },
      status: "rejected",
      conflictResult: "confirmed",
      conflictNotes: "الطرف المقابل عميل حالي للمكتب",
      conflictCheckedAt: new Date("2026-07-08T09:00:00.000Z"),
      decision: "rejected",
      decisionBy: { connect: { id: anas.id } },
      decisionAt: new Date("2026-07-09T09:00:00.000Z"),
      rejectionReason: "conflict_of_interest",
      rejectionNotes: "يتعارض مع تمثيلنا لشركة الأفق للمقاولات في قضية نشطة.",
    },
  ];

  for (const it of intakeSeed) {
    const existing = await prisma.intakeRequest.findUnique({
      where: { requestNumber: it.requestNumber },
    });
    if (!existing) {
      await prisma.intakeRequest.create({ data: it });
    }
  }

  console.log("تمت تعبئة البيانات التجريبية بنجاح:");
  console.log({
    users: userSeed.map((u) => `${u.email} (${u.role})`),
    clients: [individualClient.fullName, companyClientOne.fullName, companyClientTwo.fullName],
    cases: [
      commercialCase.internalNumber,
      laborCase.internalNumber,
      personalStatusCase.internalNumber,
      commercialTaradhiCase.internalNumber,
    ],
    templates: templatesSeed.map((t) => t.name),
    caseFlowStages: caseFlowSeed.reduce((sum, g) => sum + g.stages.length, 0),
    memos: memoSeed.length,
    intakeRequests: intakeSeed.length,
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
