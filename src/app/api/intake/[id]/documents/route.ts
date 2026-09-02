import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake } from "@/lib/intake";
import { uploadToR2, buildDocumentKey, isR2Configured } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

/** رفع مستند أولي لطلب الاستلام (يُنقل للقضية عند التفعيل). */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!canAccessIntake(session.user, intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية على هذا الطلب" }, { status: 403 });
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
    storageKey = await uploadToR2(buildDocumentKey("intake", id, file.name), buffer, file.type || undefined);
  } catch {
    return NextResponse.json({ error: "تعذّر رفع الملف إلى التخزين السحابي" }, { status: 500 });
  }

  const doc = await prisma.intakeDocument.create({
    data: {
      intakeId: id,
      title: title || file.name,
      storageKey,
      uploadedById: session.user.id,
    },
    include: { uploadedBy: { select: { fullName: true } } },
  });

  return NextResponse.json(doc, { status: 201 });
}
