import { Skeleton } from "@/components/ui/Skeleton";

export default function TemplatesHistoryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-black/5 px-5 py-4 last:border-0">
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
