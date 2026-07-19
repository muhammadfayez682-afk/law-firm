import { PrismaClient, NotificationType } from "@prisma/client";
import type { CaseType, NotificationChannel, PartyRole, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// كل أنواع الإشعارات مشتقّة من enum المولّد (تبقى متزامنة مع schema.prisma).
const ALL_NOTIFICATION_TYPES = Object.values(NotificationType);

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
      courtCaseNumber: "4568/ي-1447",
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
      courtCaseNumber: "10247/ب-1446",
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

  // قضية عمالية ثانية — رقم قوى فقط (لم يُضَف رقم محكمة بعد).
  const laborCaseTwo = await prisma.case.upsert({
    where: { internalNumber: "MZN-2026-0006" },
    update: {},
    create: {
      internalNumber: "MZN-2026-0006",
      title: "قضية عمالية - أجور متأخرة",
      caseType: "labor",
      courtName: "المحكمة العمالية بالرياض",
      claimValue: 62000,
      clientId: individualClient.id,
      status: "amicable_settlement",
      responsibleLawyerId: omar.id,
      priority: "normal",
      conflictCheckConfirmed: true,
      notes: "مطالبة بأجور متأخرة عن ثلاثة أشهر، منظورة عبر منصة قوى.",
      parties: {
        create: [
          { role: "plaintiff", name: "عبدالله بن سعيد الحربي", isOurClient: true, linkedClientId: individualClient.id },
          { role: "defendant", name: "شركة الإنشاءات المتقدمة", isOurClient: false },
        ],
      },
      clientPartyRole: "plaintiff",
      team: {
        create: [
          { userId: anas.id, roleInCase: "supervisor" },
          { userId: omar.id, roleInCase: "lawyer" },
        ],
      },
    },
  });

  await prisma.amicableSettlement.upsert({
    where: { caseId: laborCaseTwo.id },
    update: {},
    create: {
      caseId: laborCaseTwo.id,
      platform: "qiwa",
      isMandatory: true,
      requestNumber: "QIWA-778452",
      firstSessionDate: new Date("2026-08-20T10:00:00.000Z"),
      deadlineDate: new Date("2026-08-30T00:00:00.000Z"),
      outcome: "pending",
    },
  });

  // قضيتان بالرقم الداخلي فقط — لم تُرفع للمحكمة ولا تسوية بعد.
  await prisma.case.upsert({
    where: { internalNumber: "MZN-2026-0007" },
    update: {},
    create: {
      internalNumber: "MZN-2026-0007",
      title: "استشارة تجارية - مراجعة عقد توريد",
      caseType: "commercial",
      clientId: companyClientOne.id,
      status: "intake",
      responsibleLawyerId: sahar.id,
      priority: "normal",
      conflictCheckConfirmed: true,
      notes: "قيد الدراسة الأولية، لم تُرفع الدعوى بعد.",
      clientPartyRole: "plaintiff",
      parties: {
        create: [
          { role: "plaintiff", name: "شركة الأفق للمقاولات", isOurClient: true, linkedClientId: companyClientOne.id },
        ],
      },
      team: { create: [{ userId: sahar.id, roleInCase: "lawyer" }] },
    },
  });

  await prisma.case.upsert({
    where: { internalNumber: "MZN-2026-0008" },
    update: {},
    create: {
      internalNumber: "MZN-2026-0008",
      title: "نزاع مدني - مطالبة بتعويض",
      caseType: "general",
      clientId: individualClient.id,
      status: "open",
      responsibleLawyerId: lamia.id,
      priority: "normal",
      conflictCheckConfirmed: true,
      notes: "تحت الإعداد، لم يصدر رقم محكمة بعد.",
      clientPartyRole: "plaintiff",
      parties: {
        create: [
          { role: "plaintiff", name: "عبدالله بن سعيد الحربي", isOurClient: true, linkedClientId: individualClient.id },
        ],
      },
      team: { create: [{ userId: lamia.id, roleInCase: "lawyer" }] },
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

  // مهام تجريبية: 3 مربوطة بقضايا، 2 بطلبات استلام، 3 مستقلة، 2 متأخرة.
  const intake3 = await prisma.intakeRequest.findUnique({ where: { requestNumber: "INT-2026-0003" } });
  const intake4 = await prisma.intakeRequest.findUnique({ where: { requestNumber: "INT-2026-0004" } });

  const taskSeed: Prisma.TaskCreateInput[] = [
    // مربوطة بقضايا
    {
      taskNumber: "TSK-2026-0001",
      title: "بحث قانوني حول التعويض عن تأخر التسليم",
      description: "تجهيز مذكرة بحثية بالأنظمة والسوابق ذات الصلة بعقود المقاولة.",
      category: "research",
      priority: "high",
      status: "in_progress",
      startedAt: new Date("2026-07-08T09:00:00.000Z"),
      dueDate: new Date("2026-07-20T00:00:00.000Z"),
      assignedTo: { connect: { id: sultan.id } },
      assignedBy: { connect: { id: lamia.id } },
      case: { connect: { id: commercialCase.id } },
    },
    {
      taskNumber: "TSK-2026-0002",
      title: "إعداد مذكرة رد على لائحة المدعى عليه",
      description: "صياغة المسودة الأولى للمذكرة تمهيدًا لمراجعة المحامي.",
      category: "document_preparation",
      priority: "normal",
      status: "pending",
      dueDate: new Date("2026-07-22T00:00:00.000Z"),
      assignedTo: { connect: { id: yazid.id } },
      assignedBy: { connect: { id: sahar.id } },
      case: { connect: { id: laborCase.id } },
    },
    {
      taskNumber: "TSK-2026-0003",
      title: "حضور جلسة النفقة وتسجيل المحضر",
      category: "meeting",
      priority: "urgent",
      status: "pending",
      dueDate: new Date("2026-07-18T00:00:00.000Z"),
      assignedTo: { connect: { id: lamia.id } },
      assignedBy: { connect: { id: abdulrahman.id } },
      case: { connect: { id: personalStatusCase.id } },
    },
    // مربوطة بطلبات استلام
    ...(intake3
      ? [
          {
            taskNumber: "TSK-2026-0004",
            title: "إعداد دراسة تقييم لطلب الاستلام الطبي",
            description: "دراسة الموقف القانوني وتقدير الأتعاب تمهيدًا لقرار الإدارة.",
            category: "research" as const,
            priority: "high" as const,
            status: "pending" as const,
            dueDate: new Date("2026-07-19T00:00:00.000Z"),
            assignedTo: { connect: { id: sultan.id } },
            assignedBy: { connect: { id: anas.id } },
            intake: { connect: { id: intake3.id } },
          },
        ]
      : []),
    ...(intake4
      ? [
          {
            taskNumber: "TSK-2026-0005",
            title: "اجتماع أولي مع العميل لتوقيع عقد الأتعاب",
            category: "meeting" as const,
            priority: "normal" as const,
            status: "pending" as const,
            dueDate: new Date("2026-07-21T00:00:00.000Z"),
            assignedTo: { connect: { id: sahar.id } },
            assignedBy: { connect: { id: anas.id } },
            intake: { connect: { id: intake4.id } },
          },
        ]
      : []),
    // مستقلة
    {
      taskNumber: "TSK-2026-0006",
      title: "شراء مستلزمات مكتبية",
      description: "قرطاسية وأحبار طابعة لقسم الدراسات.",
      category: "administrative",
      priority: "low",
      status: "pending",
      assignedTo: { connect: { id: yazid.id } },
      assignedBy: { connect: { id: anas.id } },
    },
    {
      taskNumber: "TSK-2026-0007",
      title: "اجتماع فريق الدراسات الأسبوعي",
      category: "meeting",
      priority: "normal",
      status: "pending",
      dueDate: new Date("2026-07-16T00:00:00.000Z"),
      assignedTo: { connect: { id: sultan.id } },
      assignedBy: { connect: { id: abdulrahman.id } },
    },
    {
      taskNumber: "TSK-2026-0008",
      title: "متابعة تحديث بيانات عميل",
      category: "follow_up",
      priority: "normal",
      status: "completed",
      startedAt: new Date("2026-07-05T09:00:00.000Z"),
      completedAt: new Date("2026-07-10T09:00:00.000Z"),
      completionNote: "تم تحديث بيانات التواصل والوكالة.",
      assignedTo: { connect: { id: omar.id } },
      assignedBy: { connect: { id: anas.id } },
    },
    // متأخرة (استحقاق فائت ولم تُنجز)
    {
      taskNumber: "TSK-2026-0009",
      title: "تجهيز ملخص السوابق القضائية",
      category: "research",
      priority: "high",
      status: "pending",
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      assignedTo: { connect: { id: sultan.id } },
      assignedBy: { connect: { id: lamia.id } },
      case: { connect: { id: commercialCase.id } },
    },
    {
      taskNumber: "TSK-2026-0010",
      title: "متابعة سداد الدفعة المقدمة",
      category: "follow_up",
      priority: "urgent",
      status: "in_progress",
      startedAt: new Date("2026-06-15T09:00:00.000Z"),
      dueDate: new Date("2026-06-20T00:00:00.000Z"),
      assignedTo: { connect: { id: omar.id } },
      assignedBy: { connect: { id: anas.id } },
    },
  ];

  for (const t of taskSeed) {
    const existing = await prisma.task.findUnique({ where: { taskNumber: t.taskNumber } });
    if (!existing) {
      await prisma.task.create({ data: t });
    }
  }

  // ===== الخدمات القانونية (5 خدمات موزّعة) =====
  const serviceSeed: {
    serviceNumber: string;
    title: string;
    serviceType: "legal_consultation" | "company_formation" | "documentation" | "execution_request" | "contract_drafting";
    clientId: string;
    assignedToId: string;
    status: "new" | "in_progress" | "pending_client" | "under_review" | "completed";
    fee?: number;
  }[] = [
    { serviceNumber: "SRV-2026-0001", title: "استشارة قانونية حول عقد توريد", serviceType: "legal_consultation", clientId: companyClientOne.id, assignedToId: lamia.id, status: "in_progress", fee: 3000 },
    { serviceNumber: "SRV-2026-0002", title: "تأسيس شركة ذات مسؤولية محدودة", serviceType: "company_formation", clientId: companyClientTwo.id, assignedToId: omar.id, status: "new", fee: 12000 },
    { serviceNumber: "SRV-2026-0003", title: "توثيق عقد إيجار تجاري", serviceType: "documentation", clientId: individualClient.id, assignedToId: sahar.id, status: "under_review", fee: 1500 },
    { serviceNumber: "SRV-2026-0004", title: "طلب تنفيذ سند لأمر", serviceType: "execution_request", clientId: individualClient.id, assignedToId: lamia.id, status: "pending_client", fee: 2500 },
    { serviceNumber: "SRV-2026-0005", title: "صياغة عقد شراكة", serviceType: "contract_drafting", clientId: companyClientOne.id, assignedToId: omar.id, status: "completed", fee: 6000 },
  ];
  for (const s of serviceSeed) {
    const existing = await prisma.legalService.findUnique({ where: { serviceNumber: s.serviceNumber } });
    if (!existing) {
      await prisma.legalService.create({
        data: {
          serviceNumber: s.serviceNumber,
          title: s.title,
          serviceType: s.serviceType,
          description: `${s.title} — خدمة قانونية غير متقاضية.`,
          clientId: s.clientId,
          assignedToId: s.assignedToId,
          status: s.status,
          fee: s.fee ?? null,
          createdById: anas.id,
          ...(s.status === "completed" ? { completedAt: new Date() } : {}),
        },
      });
    }
  }

  // ===== مهام بعدة مُسندين (3) =====
  const multiTaskSeed: { taskNumber: string; title: string; category: "research" | "document_preparation" | "meeting"; caseId: string; assignees: string[] }[] = [
    { taskNumber: "TSK-2026-0011", title: "إعداد مذكرة مشتركة — نزاع المقاولة", category: "research", caseId: commercialCase.id, assignees: [lamia.id, sultan.id, omar.id] },
    { taskNumber: "TSK-2026-0012", title: "مراجعة مستندات القضية العمالية", category: "document_preparation", caseId: laborCase.id, assignees: [sahar.id, yazid.id] },
    { taskNumber: "TSK-2026-0013", title: "اجتماع تحضيري لجلسة الاستئناف", category: "meeting", caseId: commercialCase.id, assignees: [lamia.id, anas.id] },
  ];
  for (const t of multiTaskSeed) {
    const existing = await prisma.task.findUnique({ where: { taskNumber: t.taskNumber } });
    if (!existing) {
      await prisma.task.create({
        data: {
          taskNumber: t.taskNumber,
          title: t.title,
          category: t.category,
          priority: "normal",
          assignedToId: t.assignees[0],
          assignedById: anas.id,
          caseId: t.caseId,
          assignees: { create: t.assignees.map((userId) => ({ userId })) },
        },
      });
    }
  }

  // ===== جلستان عن بُعد + جلسة بعد 5 أيام =====
  const remoteSessionSeed: { caseId: string; sessionType: "hearing" | "negotiation_meeting"; daysFromNow: number; mode: "remote" | "hybrid"; platform: "zoom" | "google_meet"; link: string }[] = [
    { caseId: commercialCase.id, sessionType: "hearing", daysFromNow: 3, mode: "remote", platform: "zoom", link: "https://zoom.us/j/1234567890" },
    { caseId: laborCase.id, sessionType: "negotiation_meeting", daysFromNow: 5, mode: "remote", platform: "google_meet", link: "https://meet.google.com/abc-defg-hij" },
  ];
  for (const rs of remoteSessionSeed) {
    const existing = await prisma.session.findFirst({ where: { meetingLink: rs.link } });
    if (!existing) {
      const d = new Date(Date.now() + rs.daysFromNow * 24 * 3600 * 1000);
      await prisma.session.create({
        data: {
          caseId: rs.caseId,
          sessionType: rs.sessionType,
          sessionDate: d,
          hijriDate: null,
          sessionMode: rs.mode,
          meetingLink: rs.link,
          meetingPlatform: rs.platform,
        },
      });
    }
  }

  // ===== تفضيلات الإشعارات الافتراضية لكل المستخدمين (كل نوع → داخل النظام) =====
  const allUsersForPrefs = await prisma.user.findMany({ select: { id: true } });
  await prisma.notificationPreference.createMany({
    data: allUsersForPrefs.flatMap((u) =>
      ALL_NOTIFICATION_TYPES.map((type) => ({
        userId: u.id,
        type,
        channels: ["in_app"] as NotificationChannel[],
      }))
    ),
    skipDuplicates: true,
  });

  // ===== إشعارات تجريبية (20): 8 غير مقروءة + 12 مقروءة قديمة =====
  const existingNotifs = await prisma.notification.count();
  if (existingNotifs === 0) {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);
    const minsAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);
    const caseUrl = (id: string) => `/cases/${id}`;

    const sampleNotifs: Prisma.NotificationCreateManyInput[] = [
      // --- 8 غير مقروءة ---
      // 2 عاجلة
      { recipientId: anas.id, type: "intake_conflict_detected", priority: "urgent", title: "تعارض مصالح مؤكد", message: "فحص التعارض في الطلب INT-2026-0005 أظهر تعارضًا مؤكدًا.", actionUrl: "/intake", resourceType: "IntakeRequest", isRead: false, createdAt: minsAgo(5) },
      { recipientId: lamia.id, type: "session_reminder_hour", priority: "urgent", title: "جلسة خلال ساعة", message: `جلسة في القضية ${personalStatusCase.internalNumber} خلال ساعة تقريبًا.`, actionUrl: caseUrl(personalStatusCase.id), resourceType: "session", isRead: false, createdAt: minsAgo(20) },
      // 3 مهمة
      { recipientId: lamia.id, type: "memo_pending_review", priority: "high", title: "مذكرة بانتظار مراجعتك", message: "المذكرة «مذكرة دفاع أولية — نزاع المقاولة» أُرسلت لمراجعتك.", actionUrl: "/memos", resourceType: "LegalMemo", isRead: false, createdAt: minsAgo(90), triggeredById: sultan.id },
      { recipientId: anas.id, type: "case_closure_requested", priority: "high", title: "طلب إغلاق قضية", message: `طُلب إغلاق القضية «نزاع تجاري» (${commercialCase.internalNumber}) وينتظر اعتمادك.`, actionUrl: caseUrl(commercialCase.id), resourceType: "Case", isRead: false, createdAt: minsAgo(200) },
      { recipientId: sultan.id, type: "task_overdue", priority: "high", title: "مهمة متأخرة", message: "المهمة «إعداد مذكرة الرد» تجاوزت موعد استحقاقها.", actionUrl: "/tasks", resourceType: "Task", isRead: false, createdAt: minsAgo(300) },
      // 3 عادية
      { recipientId: abdulrahman.id, type: "intake_new", priority: "normal", title: "طلب استلام جديد", message: "طلب جديد من مؤسسة الريادة الطبية (INT-2026-0003).", actionUrl: "/intake", resourceType: "IntakeRequest", isRead: false, createdAt: minsAgo(400) },
      { recipientId: omar.id, type: "session_scheduled", priority: "normal", title: "جُدولت جلسة", message: `جلسة جديدة في القضية ${commercialTaradhiCase.internalNumber}.`, actionUrl: caseUrl(commercialTaradhiCase.id), resourceType: "session", isRead: false, createdAt: minsAgo(600) },
      { recipientId: yazid.id, type: "task_assigned", priority: "normal", title: "أُسندت إليك مهمة", message: "المهمة «بحث سوابق قضائية» (TSK-2026-0002).", actionUrl: "/tasks", resourceType: "Task", isRead: false, createdAt: minsAgo(800) },

      // --- 12 مقروءة قديمة ---
      { recipientId: sultan.id, type: "memo_approved", priority: "normal", title: "اعتُمدت مذكرتك", message: "اعتُمدت المذكرة «مذكرة دفاع أولية».", actionUrl: "/memos", resourceType: "LegalMemo", isRead: true, readAt: daysAgo(9), createdAt: daysAgo(10) },
      { recipientId: yazid.id, type: "memo_changes_requested", priority: "high", title: "طُلبت تعديلات على مذكرتك", message: "طُلبت تعديلات على المذكرة «مذكرة رد».", actionUrl: "/memos", resourceType: "LegalMemo", isRead: true, readAt: daysAgo(11), createdAt: daysAgo(12) },
      { recipientId: lamia.id, type: "case_assigned", priority: "normal", title: "أُسندت إليك قضية", message: `أُسندت إليك القضية «${personalStatusCase.internalNumber}».`, actionUrl: caseUrl(personalStatusCase.id), resourceType: "Case", isRead: true, readAt: daysAgo(14), createdAt: daysAgo(15) },
      { recipientId: sahar.id, type: "case_reopened", priority: "normal", title: "أُعيد فتح قضية", message: "أُعيد فتح قضية عمالية.", actionUrl: caseUrl(laborCase.id), resourceType: "Case", isRead: true, readAt: daysAgo(16), createdAt: daysAgo(17) },
      { recipientId: anas.id, type: "agency_expiring_soon", priority: "normal", title: "وكالة تقترب من الانتهاء", message: "وكالة العميل عبدالله الحربي تنتهي خلال 30 يومًا.", actionUrl: `/clients/${individualClient.id}`, resourceType: "agency", isRead: true, readAt: daysAgo(18), createdAt: daysAgo(20) },
      { recipientId: sahar.id, type: "settlement_deadline_soon", priority: "normal", title: "مهلة تسوية تقترب", message: `مهلة التسوية في القضية ${laborCase.internalNumber} تقترب.`, actionUrl: caseUrl(laborCase.id), resourceType: "settlement", isRead: true, readAt: daysAgo(19), createdAt: daysAgo(21) },
      { recipientId: omar.id, type: "task_completed", priority: "normal", title: "أُنجزت مهمة أسندتها", message: "أُنجزت المهمة «مراجعة عقد».", actionUrl: "/tasks", resourceType: "Task", isRead: true, readAt: daysAgo(22), createdAt: daysAgo(23) },
      { recipientId: yazid.id, type: "task_comment_added", priority: "normal", title: "ملاحظة جديدة على مهمة", message: "أُضيفت ملاحظة على مهمتك.", actionUrl: "/tasks", resourceType: "Task", isRead: true, readAt: daysAgo(24), createdAt: daysAgo(25) },
      { recipientId: anas.id, type: "intake_accepted", priority: "normal", title: "قُبل طلب استلام", message: "قُبل طلب الاستلام INT-2026-0001.", actionUrl: "/intake", resourceType: "IntakeRequest", isRead: true, readAt: daysAgo(26), createdAt: daysAgo(28) },
      { recipientId: abdulrahman.id, type: "intake_rejected", priority: "normal", title: "رُفض طلب استلام", message: "رُفض طلب الاستلام INT-2026-0005.", actionUrl: "/intake", resourceType: "IntakeRequest", isRead: true, readAt: daysAgo(27), createdAt: daysAgo(29) },
      { recipientId: lamia.id, type: "case_number_added", priority: "normal", title: "أُضيف رقم المحكمة", message: `أُضيف رقم المحكمة للقضية ${commercialCase.internalNumber}.`, actionUrl: caseUrl(commercialCase.id), resourceType: "Case", isRead: true, readAt: daysAgo(30), createdAt: daysAgo(32) },
      { recipientId: anas.id, type: "invoice_overdue", priority: "high", title: "فاتورة متأخرة", message: "فاتورة العميل شركة الأفق تجاوزت موعد استحقاقها.", actionUrl: "/invoices", resourceType: "invoice", isRead: true, readAt: daysAgo(33), createdAt: daysAgo(35) },
    ];

    await prisma.notification.createMany({ data: sampleNotifs });
  }

  // احتساب displayNumber لكل القضايا (المحكمة ← قوى/تراضي ← الداخلي) بشكل
  // idempotent — يضمن ضبط الحقل حتى للصفوف الموجودة مسبقًا (upsert update:{}).
  const allCases = await prisma.case.findMany({
    include: { amicableSettlement: { select: { requestNumber: true } } },
  });
  for (const c of allCases) {
    const displayNumber =
      c.courtCaseNumber?.trim() ||
      c.amicableSettlement?.requestNumber?.trim() ||
      c.internalNumber;
    if (displayNumber !== c.displayNumber) {
      await prisma.case.update({ where: { id: c.id }, data: { displayNumber } });
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
    tasks: taskSeed.length,
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
