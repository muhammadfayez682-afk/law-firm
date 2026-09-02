import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCase } from "@/lib/rbac";
import { getSignedDownloadUrl } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

/**
 * تنزيل مستند قضية عبر رابط موقّت — يتحقق من صلاحية المستخدم على القضية أولًا،
 * ثم يعيد التوجيه لرابط R2 المؤقّت (لا يكشف المفتاح ولا رابطًا دائمًا).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { case: { include: { team: true, accessOverrides: true, delegations: true } } },
  });
  if (!doc) return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });

  // مستند مرتبط بقضية: لا رابط لمن لا يرى القضية. مستند عام (بلا قضية): يكفي أن يكون مسجّلًا.
  if (doc.case && !canAccessCase(session.user, doc.case)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول لهذا المستند" }, { status: 403 });
  }

  if (doc.storageKey) {
    const url = await getSignedDownloadUrl(doc.storageKey, { downloadName: doc.fileName });
    return NextResponse.redirect(url, 302);
  }
  // توافق: مستندات قديمة على القرص المحلي.
  if (doc.storagePath) {
    return NextResponse.redirect(new URL(doc.storagePath, request.url), 302);
  }
  return NextResponse.json({ error: "لا يوجد ملف لهذا المستند" }, { status: 404 });
}
