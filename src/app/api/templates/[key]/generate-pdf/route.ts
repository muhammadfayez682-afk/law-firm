import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { canAccessIntake } from "@/lib/intake";
import { getTemplateDefinition, isIntakeEligibleTemplate, firstMissingRequiredField } from "@/lib/templates/definitions";
import { generateTemplatePdf } from "@/lib/pdf/generateTemplate";

const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");

type Params = { params: Promise<{ key: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { key } = await params;
  const definition = getTemplateDefinition(key);

  if (!definition || definition.staticPdfPath) {
    return NextResponse.json({ error: "النموذج غير موجود" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const intakeId: string | null = body.intakeId || null;
  const caseId: string | null = intakeId ? null : body.caseId || null;
  const sessionId: string | null = body.sessionId || null;
  const data = body.data ?? {};

  if (intakeId && !isIntakeEligibleTemplate(definition)) {
    return NextResponse.json({ error: "هذا النموذج لا يُعبّأ في مرحلة الاستلام" }, { status: 400 });
  }
  if (!intakeId && definition.linkedTo === "case" && !caseId) {
    return NextResponse.json({ error: "اختيار القضية إلزامي لهذا النموذج" }, { status: 400 });
  }
  if (definition.linkedTo === "case_session" && (!caseId || !sessionId)) {
    return NextResponse.json({ error: "اختيار القضية والجلسة إلزامي لهذا النموذج" }, { status: 400 });
  }

  if (intakeId) {
    const intake = await prisma.intakeRequest.findUnique({
      where: { id: intakeId },
      select: { id: true, receivedById: true },
    });
    if (!intake) return NextResponse.json({ error: "طلب الاستلام غير موجود" }, { status: 404 });
    if (!canAccessIntake(session.user, intake)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لطلب الاستلام" }, { status: 403 });
    }
  }

  if (caseId) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { team: true, accessOverrides: true },
    });
    if (!caseData) {
      return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
    }
    if (!canAccessCase(session.user, caseData)) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذه القضية" }, { status: 403 });
    }
  }

  // تحقق الحقول الإلزامية (مثل «ملخص الجلسة») قبل توليد PDF.
  const missing = firstMissingRequiredField(definition, data);
  if (missing) {
    return NextResponse.json(
      { error: `حقل «${missing.label}» إلزامي — لا يمكن توليد النموذج دون تعبئته.` },
      { status: 400 }
    );
  }

  let pdfPath: string;
  try {
    const pdfBuffer = await generateTemplatePdf(definition, data);
    const targetDir = path.join(GENERATED_ROOT, key);
    await mkdir(targetDir, { recursive: true });
    const fileName = `${Date.now()}.pdf`;
    await writeFile(path.join(targetDir, fileName), pdfBuffer);
    pdfPath = `/generated/${key}/${fileName}`;
  } catch {
    return NextResponse.json({ error: "تعذّر توليد ملف PDF" }, { status: 500 });
  }

  const filled = await prisma.filledTemplate.create({
    data: {
      templateKey: key,
      caseId,
      intakeId,
      sessionId,
      filledBy: session.user.id,
      data,
      pdfPath,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "FilledTemplate",
      resourceId: filled.id,
    },
  });

  return NextResponse.json({ pdfPath, filledTemplateId: filled.id }, { status: 201 });
}
