import { useLocation, useNavigate } from "react-router";
import {
  CalendarDays,
  ChartLine,
  Cog,
  Scissors,
  Users,
  UserSquare,
  ChartBar,
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

const menuItems = [
  { title: "Visão Geral", url: "/", icon: ChartLine },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Equipe", url: "/equipe", icon: UserSquare },
  { title: "Serviços", url: "/servicos", icon: Scissors },
  { title: "Relatórios", url: "/relatorios", icon: ChartBar },
];

const configItems = [
  { title: "Configurações", url: "/configuracoes", icon: Cog },
];

export function SidebarComponent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();

  function handleNavigate(url: string) {
    if (isMobile) setOpenMobile(false);
    navigate(url);
  }

  return (
    <Sidebar collapsible="icon" className="h-screen">
      <SidebarHeader className="flex items-center justify-between">
        {state === "expanded" || isMobile ? (
          <Logo style="w-full px-8 pt-2 pb-4.5 m-2 mb-4 border-b" />
        ) : (
          <img
            src="./logo.png"
            alt="logo"
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
              {menuItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    onClick={() => handleNavigate(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {configItems.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={location.pathname === item.url}
                tooltip={item.title}
                onClick={() => handleNavigate(item.url)}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
