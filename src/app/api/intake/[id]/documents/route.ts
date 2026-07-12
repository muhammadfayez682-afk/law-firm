import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake } from "@/lib/intake";

type Params = { params: Promise<{ id: string }> };

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads", "intake");

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.؀-ۿ-]/g, "_");
}

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

  const uniqueFileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const targetDir = path.join(UPLOADS_ROOT, id);

  let storagePath: string;
  try {
    await mkdir(targetDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(targetDir, uniqueFileName), buffer);
    // TODO: عند الانتقال للتخزين السحابي، استبدل الكتابة أعلاه برفع سحابي.
    storagePath = `/uploads/intake/${id}/${uniqueFileName}`;
  } catch {
    return NextResponse.json({ error: "تعذّر حفظ الملف" }, { status: 500 });
  }

  const doc = await prisma.intakeDocument.create({
    data: {
      intakeId: id,
      title: title || file.name,
      storagePath,
      uploadedById: session.user.id,
    },
    include: { uploadedBy: { select: { fullName: true } } },
  });

  return NextResponse.json(doc, { status: 201 });
}
