import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canArchiveCase } from "@/lib/caseArchive";
import { notifyBulk } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/** أرشفة قضية مغلقة/محسومة وديًا (متاح لعدة أدوار حسب الصلاحية). */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const caseData = await prisma.case.findUnique({ where: { id }, include: { team: true } });
  if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
  if (caseData.deletedAt) return NextResponse.json({ error: "القضية محذوفة" }, { status: 400 });

  if (!canArchiveCase(session.user, caseData)) {
    return NextResponse.json(
      { error: "لا تملك صلاحية أرشفة هذه القضية (يجب أن تكون مغلقة/محسومة، وأن تكون مسؤولًا عنها أو من الإدارة)" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "سبب الأرشفة مطلوب" }, { status: 400 });
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : "";

  const updated = await prisma.case.update({
    where: { id },
    data: {
      status: "archived",
      archivedAt: new Date(),
      archivedById: session.user.id,
      archiveReason: note ? `${reason} — ${note}` : reason,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "update", resourceType: "Case", resourceId: id },
  });

  const teamIds = [caseData.responsibleLawyerId, ...caseData.team.map((m) => m.userId)].filter((uid) => uid !== session.user.id);
  await notifyBulk(teamIds, {
    type: "case_archived",
    priority: "normal",
    title: "أُرشفت قضية",
    message: `أُرشفت القضية «${caseData.title}» (${caseData.internalNumber}) بواسطة ${session.user.name ?? "مستخدم"}.`,
    actionUrl: `/cases/${id}`,
    resourceType: "Case",
    resourceId: id,
    triggeredById: session.user.id,
  });

  return NextResponse.json(updated);
}
