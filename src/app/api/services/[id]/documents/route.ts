import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessService } from "@/lib/services";
import { uploadToR2, buildDocumentKey, isR2Configured } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

/** رفع مستند لخدمة قانونية إلى Cloudflare R2. */
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

  if (!isR2Configured()) {
    return NextResponse.json({ error: "التخزين السحابي غير مهيأ (R2)" }, { status: 503 });
  }

  let storageKey: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    storageKey = await uploadToR2(buildDocumentKey("services", id, file.name), buffer, file.type || undefined);
  } catch {
    return NextResponse.json({ error: "تعذّر رفع الملف إلى التخزين السحابي" }, { status: 500 });
  }

  const doc = await prisma.serviceDocument.create({
    data: { serviceId: id, uploadedById: session.user.id, title: title || file.name, storageKey },
    include: { uploadedBy: { select: { fullName: true } } },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "ServiceDocument", resourceId: doc.id },
  });

  return NextResponse.json(doc, { status: 201 });
}
