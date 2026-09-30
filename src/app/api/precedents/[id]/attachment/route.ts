import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPrecedents } from "@/lib/precedents";
import { getSignedDownloadUrl } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

/** تنزيل مرفق السابقة عبر رابط موقّت — صلاحية بالدور (الطاقم القانوني)، لا بـ ACL القضية. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!canViewPrecedents(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول لمدوّنة الأحكام" }, { status: 403 });
  }

  const { id } = await params;
  const precedent = await prisma.judgmentPrecedent.findUnique({
    where: { id },
    select: { attachmentKey: true, title: true },
  });
  if (!precedent) return NextResponse.json({ error: "السابقة غير موجودة" }, { status: 404 });
  if (!precedent.attachmentKey) return NextResponse.json({ error: "لا يوجد مرفق لهذه السابقة" }, { status: 404 });

  const url = await getSignedDownloadUrl(precedent.attachmentKey, { downloadName: `سابقة-${precedent.title}` });
  return NextResponse.redirect(url, 302);
}
