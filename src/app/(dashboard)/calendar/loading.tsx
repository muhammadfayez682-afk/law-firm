import { Skeleton } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}
