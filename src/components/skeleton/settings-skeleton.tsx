import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function SettingsSkeleton() {
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

      <main className="flex-1 flex justify-center overflow-y-auto">
        <div className="w-full max-w-180 mx-16 mt-8 mb-18 flex flex-col gap-8">
          <Card className="bg-transparent border-none">
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-30 w-30 rounded-full shrink-0" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-28" />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card className="bg-transparent border-none">
            <CardHeader>
              <Skeleton className="h-7 w-44" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-9 w-full" />
              </div>
            </CardContent>
          </Card>

          <Skeleton className="h-9 w-full max-w-xs mx-auto" />
        </div>
      </main>
    </div>
  );
}
