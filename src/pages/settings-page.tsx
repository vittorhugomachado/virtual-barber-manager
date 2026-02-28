import { SidebarComponent } from "@/components/common/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BarbershopSettingsMain } from "@/components/main/barbershop-settings-main";

export function SettingPage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <BarbershopSettingsMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
