import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { DocumentVisibility } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase, canUploadDocuments } from "@/lib/rbac";
import { uploadToR2, buildDocumentKey, isR2Configured } from "@/lib/r2";

function fileExtension(fileName: string): string {
  const match = fileName.match(/\.[^/.]+$/);
  return match ? match[0] : "";
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canUploadDocuments(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية رفع المستندات" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const caseId = formData.get("caseId") as string | null;
  const documentName = (formData.get("documentName") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null) || null;
  const visibilityLevel = (formData.get("visibilityLevel") as string | null) ?? "case_team";

  if (!file) {
    return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 });
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
      return NextResponse.json({ error: "لا تملك صلاحية رفع مستندات لهذه القضية" }, { status: 403 });
    }
  }

  const displayName = documentName ? `${documentName}${fileExtension(file.name)}` : file.name;

  if (!isR2Configured()) {
    return NextResponse.json({ error: "التخزين السحابي غير مهيأ (R2)" }, { status: 503 });
  }

  let storageKey: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = buildDocumentKey(caseId ? "cases" : "general", caseId ?? "general", file.name);
    storageKey = await uploadToR2(key, buffer, file.type || undefined);
  } catch {
    return NextResponse.json({ error: "تعذّر رفع الملف إلى التخزين السحابي" }, { status: 500 });
  }

  const document = await prisma.document.create({
    data: {
      caseId: caseId || null,
      uploadedById: session.user.id,
      fileName: displayName,
      storageKey,
      category,
      visibilityLevel: visibilityLevel as DocumentVisibility,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Document",
      resourceId: document.id,
    },
  });

  return NextResponse.json(document, { status: 201 });
}
