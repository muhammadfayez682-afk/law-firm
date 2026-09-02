import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake } from "@/lib/intake";
import { getSignedDownloadUrl } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

/** تنزيل مستند طلب استلام عبر رابط موقّت — بعد التحقق من صلاحية رؤية الطلب. */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.intakeDocument.findUnique({
    where: { id },
    include: { intake: true },
  });
  if (!doc) return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
  if (!canAccessIntake(session.user, doc.intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذا المستند" }, { status: 403 });
  }

  if (doc.storageKey) {
    const url = await getSignedDownloadUrl(doc.storageKey, { downloadName: doc.title });
    return NextResponse.redirect(url, 302);
  }
  if (doc.storagePath) {
    return NextResponse.redirect(new URL(doc.storagePath, request.url), 302);
  }
  return NextResponse.json({ error: "لا يوجد ملف لهذا المستند" }, { status: 404 });
}
