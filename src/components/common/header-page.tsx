import { useBarbershopStore } from "@/store/barbershop.store";
import { useLogout } from "@/hooks/use-logout";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderPageProps {
  page: string;
}

export function HeaderPage({ page }: HeaderPageProps) {
  const { barbershop } = useBarbershopStore();
  const { logout, isLoading } = useLogout();

  const initials = barbershop?.name?.slice(0, 2).toUpperCase() ?? "BB";

  return (
    <header className="w-full relative flex items-center justify-center md:justify-start gap-2 min-w-0 md:pl-12 mb-4 mt-3 md:mb-3.5">
      <div className="flex items-baseline gap-2 min-w-0">
        <h1 className="text-2xl font-semibold truncate max-w-50 md:max-w-xs lg:max-w-sm hidden md:block">
          {barbershop?.name}
        </h1>
        <span className="text-muted-foreground shrink-0 hidden md:block">
          |
        </span>
        <span className="text-lg font-semibold md:font-extralight md:text-muted-foreground shrink-0 translate-y-4 md:translate-y-0">
          {page}
        </span>
      </div>
      <div className="ml-auto absolute right-3 top-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none">
              <Avatar className="h-12 w-12">
                <AvatarImage src={barbershop?.logo_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium truncate">{barbershop?.name}</span>
              <span className="text-xs text-muted-foreground font-normal truncate">
                {barbershop?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              disabled={isLoading}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoading ? "Saindo..." : "Sair da conta"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
