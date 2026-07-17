import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** عدّاد سريع لغير المقروءة — يُستطلَع من جرس الإشعارات كل 30 ثانية. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const count = await prisma.notification.count({
    where: { recipientId: session.user.id, isRead: false },
  });

  return NextResponse.json({ count });
}
