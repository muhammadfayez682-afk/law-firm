import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTask, generateTaskNumber } from "@/lib/tasks";
import { resolveCasePermission, casePermissionInclude } from "@/lib/rbac";
import { notify } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/**
 * إنشاء نسخة جديدة من مهمة مرفوضة (parentTaskId = الأصل) — يخضع لصلاحية assign_tasks.
 * المهمة المرفوضة تبقى مقفلة كما هي؛ النسخة الجديدة تبدأ بحالة معلّقة.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const original = await prisma.task.findUnique({
    where: { id },
    include: { assignees: true },
  });
  if (!original) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
  if (original.status !== "rejected") {
    return NextResponse.json({ error: "النسخة الجديدة تُنشأ للمهام المرفوضة فقط" }, { status: 400 });
  }

  // الصلاحية: مرتبطة بقضية → assign_tasks (أساس/تفويض)؛ وإلا المُنشئ/الإدارة.
  let viaDelegation = false;
  if (original.caseId) {
    const caseData = await prisma.case.findUnique({
      where: { id: original.caseId },
      include: casePermissionInclude,
    });
    if (!caseData) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
    const perm = resolveCasePermission(session.user, caseData, "assign_tasks");
    if (!perm.allowed) {
      return NextResponse.json({ error: "لا تملك صلاحية إعادة إنشاء هذه المهمة" }, { status: 403 });
    }
    viaDelegation = perm.viaDelegation;
  } else if (!canManageTask(session.user, original)) {
    return NextResponse.json({ error: "إعادة الإنشاء متاحة للمُنشئ أو الإدارة فقط" }, { status: 403 });
  }

  const assigneeSpecs = original.assignees.map((a) => ({ userId: a.userId, permission: a.permission }));
  const primaryAssignee = assigneeSpecs.some((a) => a.userId === original.assignedToId)
    ? original.assignedToId
    : (assigneeSpecs[0]?.userId ?? original.assignedToId);

  const created = await prisma.$transaction(async (tx) => {
    const taskNumber = await generateTaskNumber(tx);
    return tx.task.create({
      data: {
        taskNumber,
        title: original.title,
        description: original.description,
        category: original.category,
        priority: original.priority,
        assignedById: session.user.id,
        assignedToId: primaryAssignee,
        caseId: original.caseId,
        serviceId: original.serviceId,
        intakeId: original.intakeId,
        dueDate: original.dueDate,
        parentTaskId: original.id,
        assignees: { create: assigneeSpecs.map((a) => ({ userId: a.userId, permission: a.permission })) },
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "create",
      resourceType: "Task",
      resourceId: created.id,
      viaDelegation,
    },
  });

  // إشعار المكلّفين بالنسخة الجديدة (عدا المُنشئ).
  for (const a of assigneeSpecs) {
    if (a.userId === session.user.id) continue;
    await notify({
      recipientId: a.userId,
      type: "task_recreated",
      priority: "high",
      title: "أُعيد إنشاء مهمة",
      message: `أُعيد إنشاء المهمة «${created.title}» (${created.taskNumber}) بعد رفض السابقة.`,
      actionUrl: `/tasks/${created.id}`,
      resourceType: "Task",
      resourceId: created.id,
      triggeredById: session.user.id,
    });
  }

  return NextResponse.json({ ok: true, id: created.id, taskNumber: created.taskNumber }, { status: 201 });
}
