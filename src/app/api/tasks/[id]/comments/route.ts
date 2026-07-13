import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTask } from "@/lib/tasks";

type Params = { params: Promise<{ id: string }> };

/** إضافة ملاحظة على المهمة — لأي مستخدم يرى المهمة. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, assignedToId: true, assignedById: true },
  });
  if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (!canAccessTask(session.user, task)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول" }, { status: 403 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "نص الملاحظة مطلوب" }, { status: 400 });

  const comment = await prisma.taskComment.create({
    data: { taskId: id, authorId: session.user.id, content },
    include: { author: { select: { fullName: true } } },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "create", resourceType: "TaskComment", resourceId: comment.id },
  });

  return NextResponse.json(comment, { status: 201 });
}
