import { HeaderPage } from "@/components/common/header-page";
import { SidebarComponent } from "@/components/common/sidebar";
import { ReportsMain } from "@/components/main/reports-main";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function ReportsPage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <HeaderPage page="Relatórios" />
        <ReportsMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
