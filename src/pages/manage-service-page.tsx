import { SidebarComponent } from "@/components/common/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BarbershopSettingsServicesMain } from "@/components/main/barbershop-services-page";

export function ManageServicePage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <BarbershopSettingsServicesMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
