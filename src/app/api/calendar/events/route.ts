import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseVisibilityWhere } from "@/lib/rbac";
import type { CalendarEvent } from "@/lib/calendarEvents";

const SESSION_TYPE_LABELS_AR: Record<string, string> = {
  negotiation_meeting: "جلسة تسوية ودية",
  hearing: "مرافعة",
  initial_listening: "استماع",
  verdict: "نطق بالحكم",
  arbitration: "تحكيم",
};

const SETTLEMENT_PLATFORM_LABELS_AR: Record<string, string> = {
  qiwa: "قوى",
  taradhi: "تراضي",
};

const MS_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 62 * MS_DAY; // حماية: لا يتجاوز نطاق الاستعلام ~شهرين

function caseNumberOf(c: { displayNumber: string | null; internalNumber: string }): string {
  return c.displayNumber ?? c.internalNumber;
}

/**
 * أحداث التقويم العدلي ضمن نطاق [from,to] — مقيّدة بـ caseVisibilityWhere للمستخدم الحالي.
 * مصادر: جلسات المحكمة/التسوية، مهل التسوية الودية، استحقاقات المهام المرتبطة بقضايا مرئية.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: "نطاق زمني غير صالح (from/to مطلوبان)" }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json({ error: "النطاق الزمني واسع جدًا" }, { status: 400 });
  }

  const caseWhere = caseVisibilityWhere(session.user);
  const caseSelect = { select: { id: true, title: true, internalNumber: true, displayNumber: true } };

  const [sessions, settlements, tasks] = await Promise.all([
    prisma.session.findMany({
      where: { case: caseWhere, sessionDate: { gte: from, lte: to } },
      include: { case: caseSelect },
    }),
    prisma.amicableSettlement.findMany({
      where: { case: caseWhere, outcome: "pending", deadlineDate: { gte: from, lte: to } },
      include: { case: caseSelect },
    }),
    prisma.task.findMany({
      where: {
        case: caseWhere,
        caseId: { not: null },
        cancelledAt: null,
        status: { notIn: ["completed", "cancelled", "rejected"] },
        dueDate: { gte: from, lte: to },
      },
      include: { case: caseSelect },
    }),
  ]);

  const events: CalendarEvent[] = [];

  for (const s of sessions) {
    const isSettlement = s.sessionType === "negotiation_meeting";
    const location = s.sessionMode !== "in_person" ? "عن بُعد" : s.court || null;
    events.push({
      id: `session:${s.id}`,
      type: isSettlement ? "settlement_meeting" : "session",
      title: `${SESSION_TYPE_LABELS_AR[s.sessionType] ?? s.sessionType} · ${s.case.title}`,
      caseId: s.caseId,
      caseNumber: caseNumberOf(s.case),
      start: s.sessionDate.toISOString(),
      end: null,
      location,
      url: `/cases/${s.caseId}`,
    });
  }

  for (const st of settlements) {
    if (!st.deadlineDate) continue;
    const platform = SETTLEMENT_PLATFORM_LABELS_AR[st.platform] ?? st.platform;
    events.push({
      id: `settlement:${st.id}`,
      type: "settlement_deadline",
      title: `مهلة تسوية (${platform}) · ${st.case.title}`,
      caseId: st.caseId,
      caseNumber: caseNumberOf(st.case),
      start: st.deadlineDate.toISOString(),
      end: null,
      location: platform,
      url: `/cases/${st.caseId}`,
    });
  }

  for (const t of tasks) {
    if (!t.dueDate || !t.case) continue;
    events.push({
      id: `task:${t.id}`,
      type: "task_deadline",
      title: `${t.title} · ${t.case.title}`,
      caseId: t.caseId,
      caseNumber: caseNumberOf(t.case),
      start: t.dueDate.toISOString(),
      end: null,
      location: null,
      url: `/tasks/${t.id}`,
    });
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return NextResponse.json({ events });
}
