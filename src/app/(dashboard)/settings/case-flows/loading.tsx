import { Skeleton } from "@/components/ui/Skeleton";

export default function CaseFlowsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-black/5 bg-white shadow-sm">
          <div className="border-b border-black/5 px-5 py-3">
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="p-4">
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
