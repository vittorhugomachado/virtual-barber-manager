import { useLogout } from "@/hooks/use-logout";
import { SidebarComponent } from "@/components/common/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function DashboardPage() {
  const { logout, isLoading } = useLogout();

  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <main className="flex-1 p-4 flex justify-center items-center">
          <h1>Em construção</h1>
          <Button disabled={isLoading} onClick={logout}>
            {isLoading ? "Saindo..." : "Sair da conta"}
          </Button>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
