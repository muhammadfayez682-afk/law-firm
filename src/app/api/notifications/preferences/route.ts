import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_NOTIFICATION_TYPES } from "@/lib/notifications/meta";
import { getDefaultChannels } from "@/lib/notifications/defaults";

const VALID_CHANNELS: NotificationChannel[] = ["in_app", "email", "sms", "whatsapp"];

/** تفضيلات المستخدم لكل نوع — مدموجة مع الافتراضي للأنواع غير المحفوظة. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const saved = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  });
  const savedMap = new Map(saved.map((p) => [p.type, p.channels]));

  const preferences = ALL_NOTIFICATION_TYPES.map((type) => ({
    type,
    channels: savedMap.get(type) ?? getDefaultChannels(type),
  }));

  return NextResponse.json({ preferences });
}

/** حفظ تفضيلات المستخدم — قائمة { type, channels }. */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await request.json();
  const incoming = Array.isArray(body.preferences) ? body.preferences : [];

  const updates: { type: NotificationType; channels: NotificationChannel[] }[] = [];
  for (const p of incoming) {
    if (!ALL_NOTIFICATION_TYPES.includes(p.type)) continue;
    const channels = Array.isArray(p.channels)
      ? (p.channels.filter((c: string) => VALID_CHANNELS.includes(c as NotificationChannel)) as NotificationChannel[])
      : [];
    updates.push({ type: p.type, channels });
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.notificationPreference.upsert({
        where: { userId_type: { userId: session.user.id, type: u.type } },
        update: { channels: u.channels },
        create: { userId: session.user.id, type: u.type, channels: u.channels },
      })
    )
  );

  return NextResponse.json({ updated: updates.length });
}
