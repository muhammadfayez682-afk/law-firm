import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { getSignedDownloadUrl } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

/** تنزيل مرفق صك الحكم عبر رابط موقّت — بعد التحقق من صلاحية رؤية القضية. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const verdict = await prisma.verdict.findUnique({
    where: { id },
    include: { case: { include: { team: true, accessOverrides: true, delegations: true } } },
  });
  if (!verdict) return NextResponse.json({ error: "الصك غير موجود" }, { status: 404 });
  if (!canAccessCase(session.user, verdict.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذا المرفق" }, { status: 403 });
  }
  if (!verdict.attachmentKey) {
    return NextResponse.json({ error: "لا يوجد مرفق لهذا الصك" }, { status: 404 });
  }

  const url = await getSignedDownloadUrl(verdict.attachmentKey, { downloadName: `صك-${verdict.verdictNumber}` });
  return NextResponse.redirect(url, 302);
}
