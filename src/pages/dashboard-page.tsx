import { useLogout } from "@/hooks/use-logout";
import { Button } from "@/components/ui/button";

export function DashboardPage() {
  const { logout, isLoading } = useLogout();

  return (
    <main className="w-full flex justify-center items-center">
      <h1>Em construção</h1>
      <Button disabled={isLoading} onClick={logout}>
        {isLoading ? "Saindo..." : "Sair da conta"}
      </Button>
    </main>
  );
}
