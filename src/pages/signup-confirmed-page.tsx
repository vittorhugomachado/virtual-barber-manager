import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/supabase";
import { CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

export const SignupConfirmedPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const validarTokenEConfirmar = async () => {
      if (!isMounted) return;
      setIsValidating(true);

      try {
        const token = searchParams.get("token");
        const emailParam = searchParams.get("email");

        console.log("Validando token:", { token, emailParam });

        if (!token) {
          console.warn("Acesso sem token - segurança reduzida");
          if (isMounted) {
            setIsTokenValid(false);
            setErrorMessage("Link inválido ou expirado");

            const pendingSignup = sessionStorage.getItem("pending-signup");
            if (pendingSignup) {
              const pendingData = JSON.parse(pendingSignup);
              setEmail(pendingData.email);
            }

            setIsValidating(false);
            setIsLoading(false);
          }
          return;
        }

        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "signup",
        });

        if (verifyError) {
          console.error("Erro ao validar token:", verifyError);
          if (isMounted) {
            setIsTokenValid(false);
            setErrorMessage(
              "Token inválido ou expirado. Solicite um novo link.",
            );

            if (emailParam) {
              setEmail(decodeURIComponent(emailParam));
            }

            setIsValidating(false);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setIsTokenValid(true);

          let userEmail = emailParam;
          if (!userEmail) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            userEmail = user?.email || "";
          }

          if (userEmail) {
            setEmail(decodeURIComponent(userEmail));
          }

          await supabase.auth.signOut();
          setIsValidating(false);
          setIsLoading(false);

          toast.success("Email confirmado com sucesso!", {
            duration: 4000,
          });
        }
      } catch (error) {
        console.error("Erro na validação:", error);
        if (isMounted) {
          setIsTokenValid(false);
          setErrorMessage("Erro ao validar seu cadastro. Tente novamente.");
          setIsValidating(false);
          setIsLoading(false);
        }
      }
    };

    validarTokenEConfirmar();

    return () => {
      isMounted = false;
    };
  }, [searchParams, navigate]);

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
          emailRedirectTo: `${window.location.origin}/cadastro-pendente?email=${encodeURIComponent(email)}`,
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

        // Gera novo token e atualiza URL
        const newToken = crypto.randomUUID();
        window.history.pushState(
          {},
          "",
          `/cadastro-pendente?email=${encodeURIComponent(email)}&token=${newToken}`,
        );
      }
    } catch (error) {
      toast.error("Erro ao reenviar email", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const solicitarNovoLink = async () => {
    if (!email) {
      toast.error("Email não encontrado");
      return;
    }

    await reenviarEmailConfirmacao();
  };

  // Estado: Validando token
  if (isValidating || isLoading) {
    return (
      <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
        <Logo style="w-55 md:w-60 mb-8" />
        <div className="text-center">
          <Spinner className="size-10" />
        </div>
      </main>
    );
  }

  // Estado: Token válido (sucesso)
  if (isTokenValid) {
    return (
      <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
        <Logo style="w-55 md:w-60 mb-8" />
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full max-w-md">
          <div className="flex justify-center my-2">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-green-600">
            Email confirmado!
          </h1>
          <p className="text-muted-foreground mb-4">
            Seu email {email} foi confirmado com sucesso.
          </p>
          <p className="text-muted-foreground mb-6">
            Você já pode acessar sua conta.
          </p>
          <Button type="button" onClick={() => navigate("/entrar")}>
            Entrar na conta agora
          </Button>
        </div>
      </main>
    );
  }

  // Estado: Token inválido ou expirado
  if (!isTokenValid && !isValidating) {
    return (
      <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
        <Logo style="w-55 md:w-60 mb-8" />

        <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
            <div className="flex justify-center my-2">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>

            <h1 className="text-2xl font-bold mb-2">
              Link inválido ou expirado
            </h1>

            <p className="text-muted-foreground mb-4">
              {errorMessage || "Este link de confirmação não é mais válido."}
            </p>

            {email && (
              <p className="text-sm text-muted-foreground mb-6">
                Email: {email}
              </p>
            )}

            <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                🔄 Solicite um novo link de confirmação clicando no botão
                abaixo.
                <br />
                <br />
                📧 Verifique sua caixa de spam se não receber o email.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={solicitarNovoLink}
              >
                Solicitar novo link de confirmação
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
  }

  // Estado: Carregando
  return (
    <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
      <Logo style="w-55 md:w-60 mb-8" />
      <div className="text-center">
        <Spinner className="size-10" />
      </div>
    </main>
  );
};
