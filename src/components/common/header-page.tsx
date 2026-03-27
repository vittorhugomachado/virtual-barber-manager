import { useBarbershopStore } from "@/store/barbershop.store";
import { useLogout } from "@/hooks/use-logout";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getOptimizedPublicImageUrl } from "@/lib/supabase/storage/get-optimized-public-image-url";

interface HeaderPageProps {
  page: string;
}

export function HeaderPage({ page }: HeaderPageProps) {
  const { barbershop, memberRole, memberUsername } = useBarbershopStore();
  const { logout, isLoading } = useLogout();

  const isMember = memberRole === "admin" || memberRole === "reader";
  const displayName = isMember
    ? `@${memberUsername}`
    : (barbershop?.owner_name ?? barbershop?.name ?? "");
  const displaySub = isMember
    ? memberRole === "admin"
      ? "Administrador"
      : "Leitor"
    : (barbershop?.name ?? "");
  const optimizedLogoUrl = getOptimizedPublicImageUrl(barbershop?.logo_url, {
    width: 96,
    height: 96,
    quality: 70,
  });

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
      <div className="ml-auto absolute right-4 top-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none">
              <Avatar className="h-12 w-12">
                {!isMember && (
                  <AvatarImage
                    src={optimizedLogoUrl}
                    srcSet={
                      optimizedLogoUrl
                        ? `${getOptimizedPublicImageUrl(barbershop?.logo_url, {
                            width: 48,
                            height: 48,
                            quality: 70,
                          })} 1x, ${optimizedLogoUrl} 2x`
                        : undefined
                    }
                    sizes="48px"
                    width={48}
                    height={48}
                    decoding="async"
                  />
                )}
                <AvatarFallback>
                  <User />
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground font-normal truncate">
                {displaySub}
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
