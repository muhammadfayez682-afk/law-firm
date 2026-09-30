import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessService, canEditService, canManageServiceFee } from "@/lib/services";
import { CASE_HANDLER_ROLES } from "@/lib/rbac";
import { ServiceDetailView } from "./ServiceDetailView";

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;
  const service = await prisma.legalService.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, fullName: true } },
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
      team: { include: { user: { select: { id: true, fullName: true } } } },
      notes: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      documents: { include: { uploadedBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!service) notFound();
  if (!canAccessService(session.user, service)) notFound();

  const canEdit = canEditService(session.user, service);

  // قائمة المحامين (لتعديل الفريق) — تُحمَّل فقط لمن يملك صلاحية الإدارة.
  const users = canEdit
    ? await prisma.user.findMany({
        where: { isActive: true, role: { in: CASE_HANDLER_ROLES } },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      })
    : [];

  const leadId = service.team.find((m) => m.roleInService === "lead")?.userId ?? service.assignedToId;

  const serialized = {
    ...service,
    fee: service.fee != null ? Number(service.fee) : null,
    requestedAt: service.requestedAt.toISOString(),
    dueDate: service.dueDate?.toISOString() ?? null,
    completedAt: service.completedAt?.toISOString() ?? null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    client: service.client ? { id: service.client.id, fullName: service.client.fullName } : null,
    lead: (() => {
      const m = service.team.find((t) => t.roleInService === "lead") ?? null;
      return m ? { id: m.user.id, fullName: m.user.fullName } : { id: leadId, fullName: service.assignedTo.fullName };
    })(),
    coMembers: service.team.filter((m) => m.roleInService === "co").map((m) => ({ id: m.user.id, fullName: m.user.fullName })),
    notes: service.notes.map((n) => ({ id: n.id, content: n.content, authorName: n.author.fullName, createdAt: n.createdAt.toISOString() })),
    documents: service.documents.map((d) => ({ id: d.id, title: d.title, uploadedByName: d.uploadedBy.fullName })),
  };

  return (
    <ServiceDetailView
      service={serialized}
      users={users}
      canEdit={canEdit}
      canManageFee={canManageServiceFee(session.user.role)}
    />
  );
}
