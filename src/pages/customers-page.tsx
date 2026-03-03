import { HeaderPage } from "@/components/common/header-page";
import { SidebarComponent } from "@/components/common/sidebar";
import { CustomersMain } from "@/components/main/customers-main";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function CustomersPage() {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <HeaderPage page="Clientes" />
        <CustomersMain />
      </SidebarInset>
    </SidebarProvider>
  );
}
