import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessService } from "@/lib/services";

type Params = { params: Promise<{ id: string }> };

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads", "services");

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.؀-ۿ-]/g, "_");
}

/** رفع مستند لخدمة قانونية (تخزين محلي مؤقت — مثل مستندات القضايا). */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.user.role === "accountant") {
    return NextResponse.json({ error: "لا تملك صلاحية رفع المستندات" }, { status: 403 });
  }

  const { id } = await params;
  const service = await prisma.legalService.findUnique({
    where: { id },
    select: { id: true, assignedToId: true, createdById: true },
  });
  if (!service) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
  if (!canAccessService(session.user, service)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim() || null;
  if (!file) return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 });

  const targetDir = path.join(UPLOADS_ROOT, id);
  const uniqueFileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  let storagePath: string;
  try {
    await mkdir(targetDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(targetDir, uniqueFileName), buffer);
    // TODO: استبدل بالتخزين السحابي عند الإنتاج.
    storagePath = `/uploads/services/${id}/${uniqueFileName}`;
  } catch {
    return NextResponse.json({ error: "تعذّر حفظ الملف" }, { status: 500 });
  }

  const doc = await prisma.serviceDocument.create({
    data: { serviceId: id, uploadedById: session.user.id, title: title || file.name, storagePath },
    include: { uploadedBy: { select: { fullName: true } } },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "ServiceDocument", resourceId: doc.id },
  });

  return NextResponse.json(doc, { status: 201 });
}
