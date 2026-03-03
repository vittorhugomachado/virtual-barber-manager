import { useLogout } from "@/hooks/use-logout";
import { Button } from "../ui/button";

export function BarbershopDashboardMain() {
  const { logout, isLoading } = useLogout();

  return (
    <main className="flex-1 p-4 flex justify-center items-center">
      <h1>Em construção</h1>
      <Button disabled={isLoading} onClick={logout}>
        {isLoading ? "Saindo..." : "Sair da conta"}
      </Button>
    </main>
  );
}
