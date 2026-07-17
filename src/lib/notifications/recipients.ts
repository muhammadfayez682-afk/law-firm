import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** معرّفات المستخدمين النشطين لأدوار محددة — لتحديد مستقبلي الإشعارات الجماعية. */
export async function getUserIdsByRoles(roles: UserRole[]): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
