import { Link, useLocation } from "react-router";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/common/logo";

const menuItems = [
  { title: "Visão Geral", url: "/", icon: ChartLine },
  { title: "Agendamentos", url: "/agendamentos", icon: CalendarDays },
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
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex items-center justify-between">
        {state === "expanded" ? (
          <Logo style="w-full px-8 pt-2 pb-4.5 m-2 mb-4 border-b" />
        ) : (
          <img
            src="./logo.png"
            alt="logo"
            className="w-6 mx-auto pb-4 pt-3 border-b"
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
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
                asChild
                isActive={location.pathname === item.url}
                tooltip={item.title}
              >
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
