import { SidebarComponent } from "@/components/common/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SettingsMain } from "@/components/main/settings-main";
import { HeaderPage } from "@/components/common/header-page";

export function SettingPage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <HeaderPage page="Configurações" />
        <SettingsMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
