import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabase/supabase";
import { Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export function SignupPendingPage() {
  const navigate = useNavigate();
  const { email: emailParam } = useParams<{ email: string }>();
  const email = emailParam ? decodeURIComponent(emailParam) : "";

  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Sem email na URL não há o que fazer aqui.
  useEffect(() => {
    if (!email) navigate("/entrar");
  }, [email, navigate]);

  // Contador regressivo do cooldown de reenvio.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Reenvio é SEMPRE manual (clique do usuário), para não colidir com o e-mail
  // que o cadastro acabou de disparar e cair no rate-limit do Supabase.
  async function handleResend() {
    if (!email || isResending || cooldown > 0) return;
    setIsResending(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        captchaToken: captchaToken ?? undefined,
        emailRedirectTo: `${window.location.origin}/confirmar-email`,
      },
    });

    turnstileRef.current?.reset();
    setCaptchaToken(null);
    setIsResending(false);

    if (error) {
      if (error.message.includes("security purposes")) {
        const seconds = Number(
          error.message.match(/after (\d+) seconds/)?.[1] ?? 60,
        );
        setCooldown(seconds);
        toast.info(`Aguarde ${seconds}s para reenviar.`, {
          description:
            "O link anterior ainda é válido — confira sua caixa de entrada e o spam.",
        });
      } else if (error.message.includes("captcha")) {
        toast.error("Falha na verificação de segurança.", {
          description: "Recarregue a página e tente novamente.",
        });
      } else {
        toast.error("Erro ao reenviar email.", { description: error.message });
      }
      return;
    }

    setCooldown(60);
    toast.success("Email reenviado!", {
      description: "Confira sua caixa de entrada ou o spam.",
    });
  }

  // "Já confirmei meu email": revalida o status sem reenviar nada.
  async function handleCheckConfirmed() {
    if (!email || isChecking) return;
    setIsChecking(true);

    const { data, error } = await supabase.rpc(
      "check_user_confirmation_status",
      { p_email: email },
    );

    setIsChecking(false);

    if (error) {
      toast.error("Erro ao verificar status.", { description: error.message });
      return;
    }

    if (data?.is_confirmed) {
      toast.success("Email confirmado! Faça login.");
      navigate("/entrar");
      return;
    }

    toast.info("Email ainda não confirmado.", {
      description: "Confira sua caixa de entrada ou o spam.",
    });
  }

  return (
    <main className="py-6 w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
      <Turnstile
        ref={turnstileRef}
        siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
        onSuccess={setCaptchaToken}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
        options={{ size: "invisible" }}
        style={{ display: "none" }}
      />
      <Logo style="w-55 md:w-60 mb-8" />

      <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
          <div className="flex justify-center my-2">
            <Mail className="h-12 w-12 text-[#0458EE]" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Confirme seu email</h1>
          <p className="text-sm text-muted-foreground mb-2">
            Seu email ainda não foi confirmado. Enviamos um link de ativação
            para:
          </p>
          <p className="font-medium text-foreground mb-4 break-all">{email}</p>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              ⚠️ Verifique também a caixa de spam ou lixo eletrônico.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button
              type="button"
              variant="default"
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
            >
              {isResending ? (
                <Spinner />
              ) : cooldown > 0 ? (
                `Reenviar em ${cooldown}s`
              ) : (
                "Reenviar email de confirmação"
              )}
            </Button>

            <Button
              type="button"
              variant="link"
              onClick={handleCheckConfirmed}
              disabled={isChecking}
            >
              {isChecking ? <Spinner /> : "Já confirmei meu email"}
            </Button>

            <Button
              type="button"
              variant="link"
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
