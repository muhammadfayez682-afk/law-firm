import { redirect } from "next/navigation";
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
} from "@/lib/precedents";
import { PrecedentsView } from "./PrecedentsView";

type SearchParams = { q?: string; caseType?: string; degree?: string; source?: string; keyword?: string };

export default async function PrecedentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  if (!canViewPrecedents(session.user.role)) redirect("/dashboard");

  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.JudgmentPrecedentWhereInput = {
    ...(isCaseType(sp.caseType) ? { caseType: sp.caseType } : {}),
    ...(isVerdictDegreeValue(sp.degree) ? { degree: sp.degree } : {}),
    ...(isPrecedentSource(sp.source) ? { source: sp.source } : {}),
    ...(sp.keyword?.trim() ? { keywords: { has: sp.keyword.trim() } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { principle: { contains: q, mode: "insensitive" as const } },
            { court: { contains: q, mode: "insensitive" as const } },
            { judgmentNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const rows = await prisma.judgmentPrecedent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { fullName: true } } },
  });

  const precedents = rows.map((p) => ({
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
    createdById: p.createdById,
    createdByName: p.createdBy.fullName,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <PrecedentsView
      precedents={precedents}
      canAdd={canAddPrecedents(session.user.role)}
      currentUserId={session.user.id}
      isAdmin={session.user.role === "system_admin"}
      filters={{ q: sp.q ?? "", caseType: sp.caseType ?? "", degree: sp.degree ?? "", source: sp.source ?? "" }}
    />
  );
}
