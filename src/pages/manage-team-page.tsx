import { HeaderPage } from "@/components/common/header-page";
import { SidebarComponent } from "@/components/common/sidebar";
import { ManageTeamMain } from "@/components/main/manage-team-main";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function ManageTeamPage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <HeaderPage page="Equipe" />
        <ManageTeamMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
