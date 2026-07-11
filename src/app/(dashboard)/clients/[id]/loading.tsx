import { Skeleton } from "@/components/ui/Skeleton";

export default function ClientDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
              <Skeleton className="mb-3 h-5 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
          <Skeleton className="mb-3 h-5 w-24" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
