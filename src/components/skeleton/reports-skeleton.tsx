import { Skeleton } from "../ui/skeleton";

export function ReportsSkeleton() {
  return (
    <div className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-px border-r bg-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-14" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center p-8">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-18" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-26" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="p-4">
              <Skeleton className="h-56 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
