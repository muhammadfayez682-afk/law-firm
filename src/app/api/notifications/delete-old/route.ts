import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** حذف الإشعارات المقروءة الأقدم من 30 يومًا لصاحبها. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const result = await prisma.notification.deleteMany({
    where: { recipientId: session.user.id, isRead: true, createdAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: result.count });
}
