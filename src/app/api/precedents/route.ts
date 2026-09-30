import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAddPrecedents,
  canViewPrecedents,
  isCaseType,
  isPrecedentSource,
  isVerdictDegreeValue,
  isVerdictResultValue,
} from "@/lib/precedents";
import { buildDocumentKey, isR2Configured, uploadToR2 } from "@/lib/r2";

function serialize(p: {
  id: string;
  title: string;
  principle: string;
  fullText: string | null;
  court: string | null;
  caseType: string;
  degree: string | null;
  result: string | null;
  judgmentNumber: string | null;
  judgmentDate: Date | null;
  keywords: string[];
  source: string;
  attachmentKey: string | null;
  createdAt: Date;
  createdBy: { fullName: string };
}) {
  return {
    id: p.id,
    title: p.title,
    principle: p.principle,
    fullText: p.fullText,
    court: p.court,
    caseType: p.caseType,
    degree: p.degree,
    result: p.result,
    judgmentNumber: p.judgmentNumber,
    judgmentDate: p.judgmentDate?.toISOString() ?? null,
    keywords: p.keywords,
    source: p.source,
    hasAttachment: Boolean(p.attachmentKey),
    createdByName: p.createdBy.fullName,
    createdAt: p.createdAt.toISOString(),
  };
}

function parseKeywords(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return [...new Set(raw.split(/[،,]/).map((k) => k.trim()).filter(Boolean))].slice(0, 30);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!canViewPrecedents(session.user.role)) {
    return NextResponse.json({ error: "مدوّنة الأحكام متاحة للطاقم القانوني" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const caseType = searchParams.get("caseType");
  const degree = searchParams.get("degree");
  const source = searchParams.get("source");
  const keyword = searchParams.get("keyword")?.trim();

  const where: Prisma.JudgmentPrecedentWhereInput = {
    ...(isCaseType(caseType) ? { caseType } : {}),
    ...(isVerdictDegreeValue(degree) ? { degree } : {}),
    ...(isPrecedentSource(source) ? { source } : {}),
    ...(keyword ? { keywords: { has: keyword } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { principle: { contains: q, mode: "insensitive" } },
            { court: { contains: q, mode: "insensitive" } },
            { judgmentNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const precedents = await prisma.judgmentPrecedent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { fullName: true } } },
  });

  return NextResponse.json(precedents.map(serialize));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!canAddPrecedents(session.user.role)) {
    return NextResponse.json({ error: "لا تملك صلاحية إضافة سابقة" }, { status: 403 });
  }

  const form = await request.formData();
  const title = (form.get("title") as string | null)?.trim() || "";
  const principle = (form.get("principle") as string | null)?.trim() || "";
  const caseType = form.get("caseType");
  const fullText = (form.get("fullText") as string | null)?.trim() || null;
  const court = (form.get("court") as string | null)?.trim() || null;
  const degreeRaw = form.get("degree");
  const resultRaw = form.get("result");
  const judgmentNumber = (form.get("judgmentNumber") as string | null)?.trim() || null;
  const judgmentDateRaw = (form.get("judgmentDate") as string | null)?.trim() || "";
  const sourceRaw = form.get("source");
  const sourceCaseId = (form.get("sourceCaseId") as string | null)?.trim() || null;
  const sourceVerdictId = (form.get("sourceVerdictId") as string | null)?.trim() || null;
  const keywords = parseKeywords(form.get("keywords"));
  const file = form.get("attachment") as File | null;

  if (!title) return NextResponse.json({ error: "عنوان السابقة مطلوب" }, { status: 400 });
  if (!principle) return NextResponse.json({ error: "المبدأ القانوني مطلوب" }, { status: 400 });
  if (!isCaseType(caseType)) return NextResponse.json({ error: "تصنيف السابقة مطلوب" }, { status: 400 });

  const degree = isVerdictDegreeValue(degreeRaw) ? degreeRaw : null;
  const result = isVerdictResultValue(resultRaw) ? resultRaw : null;
  const source = isPrecedentSource(sourceRaw) ? sourceRaw : "internal";
  let judgmentDate: Date | null = null;
  if (judgmentDateRaw) {
    const d = new Date(judgmentDateRaw);
    if (!Number.isNaN(d.getTime())) judgmentDate = d;
  }

  const precedent = await prisma.$transaction(async (tx) => {
    const created = await tx.judgmentPrecedent.create({
      data: {
        title,
        principle,
        fullText,
        court,
        caseType,
        degree,
        result,
        judgmentNumber,
        judgmentDate,
        keywords,
        source,
        sourceCaseId,
        sourceVerdictId,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { fullName: true } } },
    });
    return created;
  });

  // المرفق اختياري — رفع لـ R2 بمفتاح precedents ثم تحديث السجل.
  if (file && file.size > 0) {
    if (!isR2Configured()) {
      return NextResponse.json({ error: "التخزين السحابي غير مهيأ لرفع المرفق (R2)" }, { status: 503 });
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = await uploadToR2(buildDocumentKey("precedents", precedent.id, file.name), buffer, file.type || undefined);
      await prisma.judgmentPrecedent.update({ where: { id: precedent.id }, data: { attachmentKey: key } });
      precedent.attachmentKey = key;
    } catch {
      return NextResponse.json({ error: "تعذّر رفع مرفق السابقة" }, { status: 500 });
    }
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "JudgmentPrecedent", resourceId: precedent.id },
  });

  return NextResponse.json(serialize(precedent), { status: 201 });
}
