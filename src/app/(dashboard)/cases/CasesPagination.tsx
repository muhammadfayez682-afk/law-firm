import Link from "next/link";

function buildHref(params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `/cases?${qs}` : "/cases";
}

export function CasesPagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2" aria-label="ترقيم الصفحات">
      <Link
        href={buildHref(params, Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={`rounded-lg border border-black/10 px-3 py-1.5 text-sm ${
          page === 1
            ? "pointer-events-none text-foreground/30"
            : "text-navy hover:bg-black/5"
        }`}
      >
        السابق
      </Link>

      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(params, p)}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            p === page
              ? "bg-navy text-white"
              : "border border-black/10 text-navy hover:bg-black/5"
          }`}
        >
          {p}
        </Link>
      ))}

      <Link
        href={buildHref(params, Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={`rounded-lg border border-black/10 px-3 py-1.5 text-sm ${
          page === totalPages
            ? "pointer-events-none text-foreground/30"
            : "text-navy hover:bg-black/5"
        }`}
      >
        التالي
      </Link>
    </nav>
  );
}
