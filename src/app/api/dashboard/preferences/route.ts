import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_VISIBLE_WIDGETS, sanitizeWidgets } from "@/lib/dashboardWidgets";

/** تفضيلات ودجتات لوحة التحكم للمستخدم الحالي — الافتراضي إن لم تُحفظ بعد. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const pref = await prisma.userDashboardPreference.findUnique({
    where: { userId: session.user.id },
  });

  const visibleWidgets = pref ? sanitizeWidgets(pref.visibleWidgets) : DEFAULT_VISIBLE_WIDGETS;
  return NextResponse.json({ visibleWidgets, isDefault: !pref });
}

/** حفظ الودجتات الظاهرة للمستخدم الحالي (إظهار/إخفاء). */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const visibleWidgets = sanitizeWidgets(body.visibleWidgets);

  const saved = await prisma.userDashboardPreference.upsert({
    where: { userId: session.user.id },
    update: { visibleWidgets },
    create: { userId: session.user.id, visibleWidgets },
  });

  return NextResponse.json({ visibleWidgets: sanitizeWidgets(saved.visibleWidgets) });
}
