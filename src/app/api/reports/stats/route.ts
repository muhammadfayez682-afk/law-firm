import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isManagement } from "@/lib/rbac";
import { getReportsStats } from "@/lib/reports-stats";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  if (!isManagement(session.user.role) && session.user.role !== "accountant") {
    return NextResponse.json({ error: "لا تملك صلاحية الاطّلاع على التقارير" }, { status: 403 });
  }

  const stats = await getReportsStats();

  return NextResponse.json(stats);
}
