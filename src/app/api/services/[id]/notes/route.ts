import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessService } from "@/lib/services";

type Params = { params: Promise<{ id: string }> };

/** إضافة ملاحظة على الخدمة — لأي مستخدم يرى الخدمة. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await params;
  const service = await prisma.legalService.findUnique({
    where: { id },
    select: { id: true, assignedToId: true, createdById: true },
  });
  if (!service) return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
  if (!canAccessService(session.user, service)) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول" }, { status: 403 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "نص الملاحظة مطلوب" }, { status: 400 });

  const note = await prisma.serviceNote.create({
    data: { serviceId: id, authorId: session.user.id, content },
    include: { author: { select: { fullName: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
