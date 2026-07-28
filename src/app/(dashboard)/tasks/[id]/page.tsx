import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageTask,
  canAccessTask,
  displayTaskStatus,
  getAssignableUsers,
} from "@/lib/tasks";
import { TaskDetailView } from "./TaskDetailView";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { fullName: true } },
      assignedBy: { select: { fullName: true } },
      assignees: { include: { user: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
      case: { select: { id: true, internalNumber: true, title: true } },
      service: { select: { id: true, serviceNumber: true, title: true } },
      intake: { select: { id: true, requestNumber: true } },
      comments: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!task) notFound();
  if (!canAccessTask(session.user, task)) notFound();

  const myAssignee = task.assignees.find((a) => a.userId === session.user.id);

  const canManage = canManageTask(session.user, task);
  const assignableUsers = canManage
    ? await getAssignableUsers(prisma, { id: session.user.id, role: session.user.role })
    : [];

  const serialized = {
    id: task.id,
    taskNumber: task.taskNumber,
    title: task.title,
    description: task.description,
    category: task.category,
    status: task.status,
    displayStatus: displayTaskStatus(task),
    priority: task.priority,
    assignedToId: task.assignedToId,
    assignedToName: task.assignedTo.fullName,
    assignedByName: task.assignedBy.fullName,
    dueDate: task.dueDate?.toISOString() ?? null,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    completionNote: task.completionNote,
    caseId: task.case?.id ?? null,
    caseInternalNumber: task.case?.internalNumber ?? null,
    caseTitle: task.case?.title ?? null,
    serviceId: task.service?.id ?? null,
    serviceNumber: task.service?.serviceNumber ?? null,
    serviceTitle: task.service?.title ?? null,
    intakeId: task.intake?.id ?? null,
    intakeRequestNumber: task.intake?.requestNumber ?? null,
    parentTaskId: task.parentTaskId ?? null,
    assignees: task.assignees.map((a) => ({
      userId: a.userId,
      name: a.user.fullName,
      permission: a.permission,
      status: a.status,
      completionNote: a.completionNote,
      completedAt: a.completedAt?.toISOString() ?? null,
    })),
    myStatus: myAssignee?.status ?? null,
    myPermission: myAssignee?.permission ?? null,
    comments: task.comments.map((c) => ({
      id: c.id,
      content: c.content,
      authorName: c.author.fullName,
      createdAt: c.createdAt.toISOString(),
    })),
  };

  return (
    <TaskDetailView
      task={serialized}
      canManage={canManage}
      assignableUsers={assignableUsers}
    />
  );
}
