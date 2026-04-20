import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/supabase";

export function EmailConfirmedPage() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.signOut();
  }, []);

  return (
    <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
      <Logo style="w-55 md:w-60 mb-8" />

      <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
          <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-4 dark:text-green-400" />

          <h1 className="text-2xl font-bold mb-2">
            E-mail confirmado com sucesso
          </h1>

          <p className="text-muted-foreground mb-6">
            Voce ja pode fazer seu login com seguranca e acessar sua conta.
          </p>

          <Button
            type="button"
            className="w-full"
            onClick={() => navigate("/entrar")}
          >
            Fazer login
          </Button>
        </div>
      </div>
    </main>
  );
}
