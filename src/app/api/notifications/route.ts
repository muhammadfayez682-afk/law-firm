import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { NotificationPriority, NotificationType, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_NOTIFICATION_TYPES } from "@/lib/notifications/meta";

const PAGE_SIZE = 20;
const PRIORITIES: NotificationPriority[] = ["low", "normal", "high", "urgent"];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const status = searchParams.get("status"); // all | read | unread
  const type = searchParams.get("type");
  const priority = searchParams.get("priority");
  const days = searchParams.get("days"); // فترة (آخر N يوم)

  const where: Prisma.NotificationWhereInput = { recipientId: session.user.id };
  if (status === "read") where.isRead = true;
  else if (status === "unread") where.isRead = false;
  if (type && ALL_NOTIFICATION_TYPES.includes(type as NotificationType)) {
    where.type = type as NotificationType;
  }
  if (priority && PRIORITIES.includes(priority as NotificationPriority)) {
    where.priority = priority as NotificationPriority;
  }
  if (days) {
    const n = Number(days);
    if (Number.isFinite(n) && n > 0) {
      where.createdAt = { gte: new Date(Date.now() - n * 24 * 3600 * 1000) };
    }
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { recipientId: session.user.id, isRead: false } }),
  ]);

  return NextResponse.json({
    notifications,
    total,
    unreadCount,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
