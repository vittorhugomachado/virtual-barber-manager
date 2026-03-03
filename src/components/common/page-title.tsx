import { useBarbershopStore } from "@/store/barbershop.store";

interface PageTitleProps {
  page: string;
}

export function PageTitle({ page }: PageTitleProps) {
  const { barbershop } = useBarbershopStore();

  return (
    <div className="w-full flex items-baseline justify-center md:justify-start gap-2 min-w-0 md:ml-26 mt-4 md:mt-3">
      <h1 className="text-2xl font-semibold truncate max-w-50 md:max-w-xs lg:max-w-sm hidden md:block">
        {barbershop?.name}
      </h1>
      <span className="text-muted-foreground shrink-0 hidden md:block">|</span>
      <span className="text-lg font-semibold md:font-extralight md:text-muted-foreground shrink-0">
        {page}
      </span>
    </div>
  );
}
