import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDualDate } from "@/lib/dateUtils";
import {
  TEMPLATE_CATEGORY_LABELS_AR,
  TEMPLATE_CATEGORY_STYLES,
  TEMPLATE_DEFINITIONS,
  type TemplateCategory,
} from "@/lib/templates/definitions";

const CATEGORY_ORDER: TemplateCategory[] = [
  "case_progress",
  "procedures",
  "performance",
  "governance",
];

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category as TemplateCategory | undefined;

  const lastUsedRows = await prisma.filledTemplate.groupBy({
    by: ["templateKey"],
    _max: { createdAt: true },
  });
  const lastUsedMap = new Map(lastUsedRows.map((r) => [r.templateKey, r._max.createdAt]));

  const templates = activeCategory
    ? TEMPLATE_DEFINITIONS.filter((t) => t.category === activeCategory)
    : TEMPLATE_DEFINITIONS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-amiri text-2xl font-bold text-navy">النماذج</h1>
          <p className="text-sm text-foreground/60">
            النماذج المعتمدة من إدارة الدراسات والتقاضي
          </p>
        </div>
        <Link href="/templates/history" className="text-sm text-gold hover:underline">
          سجل النماذج المعبأة
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/templates"
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            !activeCategory ? "bg-navy text-white" : "border border-black/10 text-navy hover:bg-black/5"
          }`}
        >
          الكل
        </Link>
        {CATEGORY_ORDER.map((cat) => (
          <Link
            key={cat}
            href={`/templates?category=${cat}`}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-navy text-white"
                : "border border-black/10 text-navy hover:bg-black/5"
            }`}
          >
            {TEMPLATE_CATEGORY_LABELS_AR[cat]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const lastUsed = lastUsedMap.get(t.key);
          return (
            <div
              key={t.key}
              className="flex flex-col justify-between rounded-xl border border-black/5 bg-white p-5 shadow-sm"
            >
              <div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TEMPLATE_CATEGORY_STYLES[t.category]}`}
                >
                  {TEMPLATE_CATEGORY_LABELS_AR[t.category]}
                </span>
                <p className="mt-3 font-amiri text-base font-bold text-navy">{t.name}</p>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-foreground/60">
                  {t.description}
                </p>
                <p className="mt-3 text-[11px] text-foreground/40">
                  {lastUsed
                    ? `آخر استخدام: ${formatDualDate(lastUsed)}`
                    : "لم يُستخدم بعد"}
                </p>
              </div>

              {t.staticPdfPath ? (
                <a
                  href={t.staticPdfPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-navy px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5"
                >
                  عرض البيان
                </a>
              ) : (
                <Link
                  href={`/templates/${t.key}/fill`}
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
                >
                  تعبئة
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
