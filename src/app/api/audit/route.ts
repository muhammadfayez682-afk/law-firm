import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAuditLog } from "@/lib/rbac";
import { AUDIT_PAGE_SIZE, buildAuditWhere } from "@/lib/audit";

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
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { user: { select: { fullName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pageSize: AUDIT_PAGE_SIZE });
}
