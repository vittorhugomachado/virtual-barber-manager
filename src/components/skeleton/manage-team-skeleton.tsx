import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ManageTeamSkeleton() {
  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 pb-12 mx-auto">
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="relative w-full max-w-80 mx-auto">
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
              <Skeleton className="absolute top-3 right-3 h-5 w-12 rounded-full" />
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="flex flex-col items-center gap-2 w-full">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 pt-8 pb-6 h-full min-h-52">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
