import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessService, canEditService, canManageServiceFee } from "@/lib/services";
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
      notes: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
      documents: { include: { uploadedBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!service) notFound();
  if (!canAccessService(session.user, service)) notFound();

  const serialized = {
    ...service,
    fee: service.fee != null ? Number(service.fee) : null,
    requestedAt: service.requestedAt.toISOString(),
    dueDate: service.dueDate?.toISOString() ?? null,
    completedAt: service.completedAt?.toISOString() ?? null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    notes: service.notes.map((n) => ({ id: n.id, content: n.content, authorName: n.author.fullName, createdAt: n.createdAt.toISOString() })),
    documents: service.documents.map((d) => ({ id: d.id, title: d.title, storagePath: d.storagePath, uploadedByName: d.uploadedBy.fullName })),
  };

  return (
    <ServiceDetailView
      service={serialized}
      canEdit={canEditService(session.user, service)}
      canManageFee={canManageServiceFee(session.user.role)}
    />
  );
}
