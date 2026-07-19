import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/rbac";
import { CHANGE_REASON_LABELS_AR } from "@/lib/editPermissions";

function csvCell(v: string | null): string {
  const s = (v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

/** تصدير كل سجل التعديلات CSV — مسؤول النظام فقط (UTF-8 + BOM). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  if (!isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "تصدير سجل التعديلات متاح لمسؤول النظام فقط" }, { status: 403 });
  }

  const logs = await prisma.entityChangeLog.findMany({
    orderBy: { changedAt: "desc" },
    include: { changedBy: { select: { fullName: true } } },
    take: 10000,
  });

  const header = ["التاريخ", "الكيان", "المعرّف", "الحقل", "القيمة السابقة", "القيمة الجديدة", "من عدّل", "السبب", "الملاحظة"];
  const rows = logs.map((l) =>
    [
      l.changedAt.toISOString(),
      l.entityType,
      l.entityId,
      l.fieldLabel,
      l.oldValue,
      l.newValue,
      l.changedBy.fullName,
      CHANGE_REASON_LABELS_AR[l.changeReason],
      l.reasonNote,
    ]
      .map((c) => csvCell(c as string | null))
      .join(",")
  );

  const csv = "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="change-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
