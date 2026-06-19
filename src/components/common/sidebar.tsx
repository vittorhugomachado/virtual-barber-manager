import { useLocation, useNavigate } from "react-router";
import {
  //   AlertTriangle,
  CalendarDays,
  ChartLine,
  Cog,
  Scissors,
  Users,
  UserSquare,
  ChartBar,
  Shield,
  User,
  Palette,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/common/logo";
import { useBarbershopStore } from "@/store/barbershop.store";
// import { useDashboard } from "@/hooks/use-dashboard";
// import { useSettingsAlerts } from "@/hooks/use-settings-alerts";

const menuItems = [
  { title: "Visão Geral", url: "/", icon: ChartLine },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Equipe", url: "/equipe", icon: UserSquare },
  { title: "Serviços", url: "/servicos", icon: Scissors },
  { title: "Relatórios", url: "/relatorios", icon: ChartBar },
  { title: "Página", url: "/editar-pagina", icon: Palette },
];

const readerMenuItems = [
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
];

const configItems = [
  { title: "Configurações", url: "/configuracoes", icon: Cog },
];

export function SidebarComponent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { memberRole, memberUsername } = useBarbershopStore();
  //   const { activeServices, activeProfessionals, loading } = useDashboard();
  //   const { missingAddress, missingHours } = useSettingsAlerts();
  const visibleMenuItems =
    memberRole === "reader" ? readerMenuItems : menuItems;
  const visibleConfigItems = memberRole === "owner" ? configItems : [];

  function handleNavigate(url: string) {
    if (isMobile) setOpenMobile(false);
    navigate(url);
  }

  //   function showMenuAlert(url: string) {
  //     if (loading) return false;
  //     if (url === "/servicos") return activeServices === 0;
  //     if (url === "/equipe") return activeProfessionals === 0;
  //     return false;
  //   }

  return (
    <Sidebar
      collapsible="icon"
      className="h-screen max-w-65"
      style={{
        top: "var(--top-notice-height, 0px)",
        height: "calc(100svh - var(--top-notice-height, 0px))",
      }}
    >
      <SidebarHeader className="flex items-center justify-between">
        {state === "expanded" || isMobile ? (
          <Logo style="w-full px-8 pt-2 pb-4.5 m-2 mb-4 border-b" />
        ) : (
          <img
            src="./logo.png"
            alt="logo"
            width={150}
            height={151}
            loading="eager"
            decoding="async"
            className="w-6 mx-auto pb-4 pt-3 border-b"
          />
        )}
        <div className="flex items-center absolute top-0 -right-12 gap-2 p-4">
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    onClick={() => handleNavigate(item.url)}
                    className="cursor-pointer"
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    {/* {showMenuAlert(item.url) && (
                      <AlertTriangle className="ml-auto h-4 w-4 shrink-0 text-yellow-500" />
                    )} */}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {visibleConfigItems.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={location.pathname === item.url}
                tooltip={item.title}
                onClick={() => handleNavigate(item.url)}
                className="cursor-pointer"
              >
                <item.icon />
                <span>{item.title}</span>
                {/* {(missingAddress || missingHours) && (
                  <AlertTriangle className="ml-auto h-4 w-4 shrink-0 text-yellow-500" />
                )} */}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {(memberRole === "admin" || memberRole === "reader") &&
          memberUsername && (
            <div className="flex items-center gap-2.5 px-2 py-2 mx-1 mb-1 rounded-lg bg-muted/60">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {memberRole === "admin" ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="text-sm font-medium truncate">
                  @{memberUsername}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {memberRole === "admin" ? "Administrador" : "Leitor"}
                </span>
              </div>
            </div>
          )}
      </SidebarFooter>
    </Sidebar>
  );
}
