import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, CircleX, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";

type ConfirmationStatus = "loading" | "success" | "error";

export function EmailChangeConfirmedPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConfirmationStatus>("loading");

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setStatus(!error && data.session ? "success" : "error");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "USER_UPDATED" || event === "SIGNED_IN") {
        setStatus(session ? "success" : "error");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="flex min-h-screen w-screen flex-col items-center justify-center overflow-x-hidden bg-zinc-100 px-4 dark:bg-transparent">
      <Logo style="w-55 md:w-60 mb-8" />
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-zinc-900">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
            <h1 className="text-xl font-bold">Confirmando alteração...</h1>
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-8 w-8 text-green-600" />
            <h1 className="mb-2 text-2xl font-bold">
              E-mail confirmado com sucesso
            </h1>
            <p className="mb-6 text-muted-foreground">
              O novo endereço já pode ser usado na sua conta.
            </p>
            <Button
              className="w-full"
              onClick={() => navigate("/?modal=configuracoes")}
            >
              Voltar às configurações
            </Button>
          </>
        ) : (
          <>
            <CircleX className="mx-auto mb-4 h-8 w-8 text-red-600" />
            <h1 className="mb-2 text-2xl font-bold">
              Link inválido ou expirado
            </h1>
            <p className="mb-6 text-muted-foreground">
              Solicite novamente a alteração do email nas configurações da sua
              conta.
            </p>
            <Button className="w-full" onClick={() => navigate("/entrar")}>
              Voltar para o login
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
