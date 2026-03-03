import { HeaderPage } from "@/components/common/header-page";
import { SidebarComponent } from "@/components/common/sidebar";
import { AppointmentsMain } from "@/components/main/appointments-main";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppointmentsPage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <HeaderPage page="Agenda" />
        <AppointmentsMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
