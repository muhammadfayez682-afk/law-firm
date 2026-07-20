import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { CaseStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRestoreCase } from "@/lib/caseArchive";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** استرجاع قضية من الأرشيف — مسؤول النظام والمشرف فقط. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (!canRestoreCase(session.user)) {
    return NextResponse.json({ error: "الاسترجاع متاح لمسؤول النظام أو المشرف فقط" }, { status: 403 });
  }

  const { id } = await params;
  const caseData = await prisma.case.findUnique({ where: { id }, include: { team: true } });
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (caseData.status !== "archived") {
    return NextResponse.json({ error: "القضية ليست مؤرشفة" }, { status: 400 });
  }

  const body = await request.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "سبب الاسترجاع مطلوب" }, { status: 400 });

  // تعود للحالة المنتهية المناسبة (settled_amicably إن كانت محسومة صلحًا، وإلا closed).
  const restoredStatus: CaseStatus = caseData.outcome === "settled" ? "settled_amicably" : "closed";

  const updated = await prisma.case.update({
    where: { id },
    data: { status: restoredStatus, archivedAt: null, archivedById: null, archiveReason: null },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Case", resourceId: id },
  });

  const teamIds = [caseData.responsibleLawyerId, ...caseData.team.map((m) => m.userId)].filter((uid) => uid !== session.user.id);
  await notifyBulk(teamIds, {
    type: "case_restored",
    priority: "normal",
    title: "أُعيدت قضية من الأرشيف",
    message: `أُعيدت القضية «${caseData.title}» (${caseData.internalNumber}) من الأرشيف: ${reason}`,
    actionUrl: `/cases/${id}`,
    resourceType: "Case",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(updated);
}
