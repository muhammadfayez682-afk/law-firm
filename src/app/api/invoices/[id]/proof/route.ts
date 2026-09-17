import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvoices } from "@/lib/rbac";
import { getSignedDownloadUrl } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

/** عرض إثبات الحوالة عبر رابط موقّت — محكوم بصلاحية إدارة الفواتير (لا يكشف مفتاح R2، لا رابط دائم). */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  if (!canManageInvoices(session.user.role)) {
    return NextResponse.json({ error: "عرض إثبات الحوالة متاح للشركاء والمحاسب فقط" }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { paymentProofKey: true } });
  if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
  if (!invoice.paymentProofKey) {
    return NextResponse.json({ error: "لا يوجد إثبات حوالة لهذه الفاتورة" }, { status: 404 });
  }

  const url = await getSignedDownloadUrl(invoice.paymentProofKey, { downloadName: `حوالة-${id.slice(0, 8)}` });
  return NextResponse.redirect(url, 302);
}
