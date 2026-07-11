import { Skeleton } from "@/components/ui/Skeleton";

export default function TemplateFillLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-5 w-24" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
          <Skeleton className="mb-4 h-5 w-24" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
