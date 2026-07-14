import { Skeleton } from "@/components/ui/skeleton";

export function CustomersSkeleton() {
  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 pb-12 mx-auto mt-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Skeleton className="h-9 w-full md:w-72" />
          <Skeleton className="h-9 w-32 shrink-0" />
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-x-clip">
        {/* Header da tabela */}
        <div className="flex items-center gap-4 px-6 py-3 border-b">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20 hidden md:block ml-auto" />
          <Skeleton className="h-3 w-24 hidden lg:block" />
          <Skeleton className="h-3 w-20 hidden lg:block" />
          <Skeleton className="h-3 w-28 ml-auto" />
        </div>

        {/* Linhas */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-6 py-4 border-b last:border-0"
          >
            {/* Nome + telefone mobile */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28 md:hidden" />
            </div>

            {/* Telefone desktop */}
            <Skeleton className="h-3 w-28 hidden md:block shrink-0" />

            {/* Agendamentos */}
            <Skeleton className="h-3 w-8 hidden lg:block shrink-0 mx-auto" />

            {/* Última visita */}
            <Skeleton className="h-3 w-20 hidden lg:block shrink-0" />

            {/* Botões */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Skeleton className="h-8 w-8 md:w-20" />
              <Skeleton className="h-8 w-8 md:w-24" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
