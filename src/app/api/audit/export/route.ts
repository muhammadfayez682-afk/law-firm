import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAuditLog, ROLE_LABELS_AR } from "@/lib/rbac";
import { AUDIT_ACTION_LABELS_AR, buildAuditWhere, resourceTypeLabel } from "@/lib/audit";
import { formatDualDateTime } from "@/lib/dateUtils";

/** تهريب حقل CSV: تغليف بعلامات اقتباس ومضاعفة أي اقتباس داخلي. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!canViewAuditLog(session.user.role)) {
    return NextResponse.json({ error: "سجل التدقيق متاح للشركاء فقط" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const where = buildAuditWhere({
    q: searchParams.get("q"),
    userId: searchParams.get("userId"),
    action: searchParams.get("action"),
    resourceType: searchParams.get("resourceType"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true, role: true } } },
    take: 10000,
  });

  const header = ["التاريخ والوقت", "المستخدم", "الدور", "الإجراء", "نوع المورد", "معرّف المورد", "عنوان IP"];
  const lines = [header.map(csvCell).join(",")];

  for (const log of logs) {
    lines.push(
      [
        formatDualDateTime(log.createdAt),
        log.user.fullName,
        ROLE_LABELS_AR[log.user.role],
        AUDIT_ACTION_LABELS_AR[log.action],
        resourceTypeLabel(log.resourceType),
        log.resourceId,
        log.ipAddress ?? "",
      ]
        .map((c) => csvCell(String(c)))
        .join(",")
    );
  }

  // BOM لضمان قراءة Excel للعربية بترميز UTF-8 بشكل صحيح.
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
    },
  });
}
