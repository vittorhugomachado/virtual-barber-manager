import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/utils/format-phone";
import { supabase } from "@/lib/supabase/supabase";
import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

export const SignupPendingPage = () => {
  const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE;
  const phone = formatPhone(SUPPORT_PHONE);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [email, setEmail] = useState("");
  console.log(isConfirmed);
  useEffect(() => {
    let isMounted = true;

    const verificarStatusEmail = async () => {
      if (!isMounted) return;
      setIsLoading(true);

      try {
        // 1. Tenta pegar o email da URL
        let userEmail = window.location.pathname.split(
          "/cadastro-pendente/",
        )[1];

        // 2. Se não tiver na URL, tenta do sessionStorage
        if (!userEmail || userEmail === "") {
          const pendingSignup = sessionStorage.getItem("pending-signup");
          if (pendingSignup) {
            const pendingData = JSON.parse(pendingSignup);
            userEmail = pendingData.email;
            // Limpa o sessionStorage para não reutilizar
            sessionStorage.removeItem("pending-signup");
          }
        }

        // 3. Decodifica o email (caso tenha @ ou caracteres especiais)
        if (userEmail) {
          userEmail = decodeURIComponent(userEmail);
        }

        console.log("Email a ser verificado:", userEmail);

        if (!userEmail || userEmail === "") {
          toast.error("Email não encontrado");
          navigate("/entrar");
          return;
        }

        if (isMounted) {
          setEmail(userEmail);
        }

        // 4. 🔍 USA A RPC PARA CONSULTAR O AUTH.USERS
        const { data: userStatus, error: rpcError } = await supabase.rpc(
          "check_user_confirmation_status",
          { p_email: userEmail },
        );

        console.log("Status retornado pela RPC:", userStatus);

        if (rpcError) {
          console.error("Erro na RPC:", rpcError);
          toast.error("Erro ao verificar status da conta");
          if (isMounted) setIsLoading(false);
          return;
        }

        if (!userStatus?.exists) {
          // Usuário não existe no auth.users
          toast.error("Usuário não encontrado");
          navigate("/entrar");
          return;
        }

        // 5. VERIFICA SE O USUÁRIO JÁ FEZ LOGIN ALGUMA VEZ
        if (userStatus.is_confirmed) {
          console.log("Usuário já fez login em:", userStatus.last_sign_in_at);
          if (isMounted) setIsConfirmed(true);
          toast.success("Email já confirmado! Faça login.", {
            duration: 4000,
          });
        } else {
          console.log("Usuário pendente - last_sign_in_at é NULL");
          if (isMounted) setIsConfirmed(false);
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error);
        toast.error("Erro ao verificar status da conta");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    verificarStatusEmail();

    return () => {
      isMounted = false;
    };
  }, [navigate]); // Dependências necessárias

  // Função para reenviar email de confirmação
  const reenviarEmailConfirmacao = async () => {
    if (!email) {
      toast.error("Email não encontrado");
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/email-confirmado`,
        },
      });

      if (error) {
        toast.error("Erro ao reenviar email", {
          description: error.message,
        });
      } else {
        toast.success("Email reenviado!", {
          description: "Verifique sua caixa de entrada ou spam.",
        });
      }
    } catch (error) {
      toast.error("Erro ao reenviar email", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Função para verificar manualmente (botão "Já confirmei")
  const verificarNovamente = async () => {
    setEmail(email); // Manter o email atual
    setIsLoading(true);

    try {
      const { data: userStatus, error: rpcError } = await supabase.rpc(
        "check_user_confirmation_status",
        { p_email: email },
      );

      if (!rpcError && userStatus?.is_confirmed) {
        setIsConfirmed(true);
        toast.success("Email já confirmado! Faça login.", {
          duration: 4000,
        });
        setTimeout(() => navigate("/entrar"), 2000);
      } else {
        toast.info("Email ainda não foi confirmado.", {
          duration: 3000,
        });
      }
    } catch (error) {
      toast.error("Erro ao verificar status", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
        <Logo style="w-55 md:w-60 mb-8" />
        <div className="text-center">
          <Spinner className="size-10 mx-auto" />
        </div>
      </main>
    );
  }

  // Se já estiver confirmado (já fez login), mostra mensagem e redireciona
  if (isConfirmed) {
    return (
      <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
        <Logo style="w-55 md:w-60 mb-8" />
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full max-w-md">
          <div className="flex justify-center my-2">
            <Mail className="h-12 w-12 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-green-700">
            Email confirmado!
          </h1>
          <p className="text-muted-foreground mb-6">
            Sua conta foi ativada. Você já pode entrar na sua conta com
            segurança.
          </p>
          <Button type="button" onClick={() => navigate("/entrar")}>
            Entrar agora
          </Button>
        </div>
      </main>
    );
  }

  // Se está pendente (nunca fez login), mostra a página de aguardando confirmação
  return (
    <main className=" py-6 w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
      <Logo style="w-55 md:w-60 mb-8" />

      <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
          <div className="flex justify-center my-2">
            <Mail className="h-12 w-12 text-[#0458EE]" />
          </div>

          <h1 className="text-2xl font-bold mb-2">
            Aguardando ativação da conta
          </h1>
          <p className="text-sm text-muted-foreground mb-2">
            Enviamos um link de confirmação para:
          </p>
          <p className="font-medium text-foreground mb-4">{email}</p>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              ⚠️ Verifique sua caixa de spam ou lixo eletrônico se não encontrar
              o email.
            </p>
          </div>

          <p className="text-xs text-muted-foreground mb-6">
            Precisa de ajuda? Fale conosco: {phone}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={reenviarEmailConfirmacao}
            >
              Reenviar email de confirmação
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={verificarNovamente}
              disabled={isLoading}
            >
              Já confirmei meu email
            </Button>

            <Button
              type="button"
              variant="default"
              onClick={() => navigate("/entrar")}
            >
              Voltar para o login
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};
