import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIntake } from "@/lib/intake";

type Params = { params: Promise<{ id: string }> };

/** إضافة ملاحظة على طلب الاستلام. */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;
  const intake = await prisma.intakeRequest.findUnique({ where: { id } });
  if (!intake) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (!canAccessIntake(session.user, intake)) {
    return NextResponse.json({ error: "لا تملك صلاحية على هذا الطلب" }, { status: 403 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "نص الملاحظة مطلوب" }, { status: 400 });

  const note = await prisma.intakeNote.create({
    data: { intakeId: id, content, authorId: session.user.id },
    include: { author: { select: { fullName: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
