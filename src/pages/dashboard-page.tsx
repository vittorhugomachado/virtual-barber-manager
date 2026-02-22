import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

export function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await supabase.auth.signOut();
      navigate("/entrar");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="w-full flex justify-center items-center">
      <h1>Em construção</h1>
      <Button disabled={isLoading} onClick={handleLogout}>
        {isLoading ? "Saindo..." : "Sair da conta"}
      </Button>
    </main>
  );
}
