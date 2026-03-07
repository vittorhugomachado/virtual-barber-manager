import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex w-full h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-card">
        <div className="p-4 space-y-6 flex-1">
          <div className="flex items-center gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <Skeleton className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-[#222225]" />
            <Skeleton className="h-6 w-24 bg-zinc-200 dark:bg-[#222225]" />
          </div>

          <nav className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="h-5 w-5 rounded-md bg-zinc-200 dark:bg-[#222225]" />
                <Skeleton className="h-5 w-20 bg-zinc-200 dark:bg-[#222225]" />
              </div>
            ))}
          </nav>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="h-5 w-5 rounded-md bg-zinc-200 dark:bg-[#222225]" />
              <Skeleton className="h-5 w-16 bg-zinc-200 dark:bg-[#222225]" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0 bg-zinc-200 dark:bg-[#222225]" />
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-4 w-24 bg-zinc-200 dark:bg-[#222225]" />
              <Skeleton className="h-3 w-20 bg-zinc-200 dark:bg-[#222225]" />
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-10 w-36 md:w-48 mb-2 bg-zinc-200 dark:bg-card" />
          </div>
          <Skeleton className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-card" />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`card-${i}`}
                className="bg-zinc-200 dark:bg-card rounded-xl p-4 space-y-3"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-zinc-200 dark:bg-card rounded-xl p-4 md:col-span-1 h-40">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-12" />
            </div>

            <div className="bg-zinc-200 dark:bg-card rounded-xl p-4 md:col-span-2 h-40">
              <Skeleton className="h-4 w-24 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </div>

            <div className="bg-zinc-200 dark:bg-card rounded-xl p-4 md:col-span-1 h-40">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-12" />
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>

          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`list-item-${i}`}
              className="h-20 w-full rounded-lg bg-zinc-200 dark:bg-card p-3 flex items-center gap-3 md:gap-4"
            >
              <Skeleton className="h-12 w-12 rounded-md shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-4 w-36 md:w-48" />
                <Skeleton className="h-3 w-24 md:w-32" />
              </div>
              <Skeleton className="h-8 w-16 md:w-20 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
