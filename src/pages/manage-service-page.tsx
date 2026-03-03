import { SidebarComponent } from "@/components/common/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ServicesMain } from "@/components/main/services-main";
import { HeaderPage } from "@/components/common/header-page";

export function ManageServicePage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <HeaderPage page="Serviços" />
        <ServicesMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
