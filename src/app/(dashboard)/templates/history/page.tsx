import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManagement } from "@/lib/rbac";
import { getTemplateDefinition } from "@/lib/templates/definitions";
import { formatDualDateTime } from "@/lib/dateUtils";

export default async function TemplatesHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const filled = await prisma.filledTemplate.findMany({
    where: isManagement(session.user.role) ? {} : { filledBy: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { case: true, user: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">سجل النماذج المعبأة</h1>
          <p className="text-sm text-foreground/60">{filled.length} نموذج</p>
        </div>
        <Link href="/templates" className="text-sm text-gold hover:underline">
          العودة للنماذج
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="hidden grid-cols-5 gap-4 border-b border-black/5 bg-navy/5 px-5 py-3 text-xs font-medium text-foreground/50 sm:grid">
          <span>اسم النموذج</span>
          <span>القضية المرتبطة</span>
          <span>من ملأه</span>
          <span>التاريخ</span>
          <span>الملف</span>
        </div>

        <div className="divide-y divide-black/5">
          {filled.map((f) => {
            const definition = getTemplateDefinition(f.templateKey);
            return (
              <div
                key={f.id}
                className="grid grid-cols-1 gap-1 px-5 py-3 text-sm sm:grid-cols-5 sm:items-center sm:gap-4"
              >
                <span className="font-medium text-navy">{definition?.name ?? f.templateKey}</span>
                <span className="text-foreground/70">
                  {f.case ? (
                    <Link href={`/cases/${f.case.id}`} className="text-taradhi hover:underline">
                      {f.case.internalNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-foreground/70">{f.user.fullName}</span>
                <span className="text-xs text-foreground/50">
                  {formatDualDateTime(f.createdAt)}
                </span>
                <span>
                  {f.pdfPath ? (
                    <a
                      href={f.pdfPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy/5"
                    >
                      تحميل PDF
                    </a>
                  ) : (
                    <span className="text-xs text-foreground/40">مسودة بدون PDF</span>
                  )}
                </span>
              </div>
            );
          })}

          {filled.length === 0 && (
            <div className="px-5 py-10 text-center text-foreground/50">
              لا توجد نماذج معبأة بعد
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
