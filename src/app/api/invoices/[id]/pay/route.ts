import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInvoices } from "@/lib/rbac";
import { buildDocumentKey, uploadToR2, isR2Configured } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** سداد فاتورة: يتطلّب رفع إثبات الحوالة (صورة/PDF) — يرفعه لـ R2 ثم يضبط paid + paidAt + مفتاح الحوالة. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  if (!canManageInvoices(session.user.role)) {
    return NextResponse.json({ error: "سداد الفواتير متاح للشركاء والمحاسب فقط" }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
  if (invoice.status === "paid") {
    return NextResponse.json({ error: "الفاتورة مدفوعة بالفعل" }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "خدمة التخزين غير مهيّأة — تعذّر رفع إثبات الحوالة" }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "إثبات الحوالة مطلوب — ارفع صورة أو ملف PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "حجم الملف يتجاوز 10 ميغابايت" }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم — يُقبل PDF أو صورة (JPG/PNG/WebP)" }, { status: 400 });
  }

  const key = buildDocumentKey("invoices", id, file.name || "payment-proof");
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadToR2(key, bytes, file.type || "application/octet-stream");

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "paid", paidAt: new Date(), paymentProofKey: key },
    include: { client: true, case: { select: { id: true, title: true, internalNumber: true } } },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Invoice", resourceId: id },
  });

  return NextResponse.json(updated);
}
