import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router";
import { CircleCheck, CircleX } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

type ResendState =
  | "idle"
  | "sending"
  | "not_found"
  | "already_confirmed"
  | "sent";

export function ConfirmSignupPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [email, setEmail] = useState("");
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatus("error");
        return;
      }
      setStatus("success");
    }

    checkSession();
  }, []);

  useEffect(() => {
    if (status === "success") {
      navigate("/painel");
    }
  }, [status, navigate]);

  async function handleResend() {
    if (!email) {
      toast.error("Informe seu email.");
      return;
    }

    setResendError(null);
    setResendState("sending");

    const { data: userStatus, error: checkError } = await supabase.rpc(
      "check_user_confirmation_status",
      { p_email: email },
    );

    if (checkError) {
      setResendState("idle");
      toast.error("Erro ao verificar email.", {
        description: checkError.message,
      });
      return;
    }

    if (!userStatus?.exists) {
      setResendState("not_found");
      return;
    }

    if (userStatus.is_confirmed) {
      setResendState("already_confirmed");
      return;
    }

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

    if (error) {
      setResendState("idle");
      if (error.message.includes("security purposes")) {
        const seconds = error.message.match(/after (\d+) seconds/)?.[1];
        setResendError(
          seconds
            ? `Aguarde ${seconds} segundos antes de tentar novamente.`
            : "Aguarde alguns segundos antes de tentar novamente.",
        );
      } else if (error.message.includes("captcha")) {
        setResendError(
          "Erro de verificação de segurança. Recarregue a página e tente novamente.",
        );
      } else {
        toast.error("Erro ao reenviar.", { description: error.message });
      }
      return;
    }

    setResendState("sent");
  }

  if (status === "loading" || status === "success") {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Spinner className="size-10" />
      </div>
    );
  }

  return (
    <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
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
          {resendState === "sent" || resendState === "already_confirmed" ? (
            <>
              <CircleCheck className="w-8 h-8 text-green-500 mx-auto mb-4" />

              <h1 className="text-2xl font-bold mb-2">
                {resendState === "sent"
                  ? "Email enviado"
                  : "Email já confirmado"}
              </h1>

              <p className="text-muted-foreground">
                {resendState === "sent"
                  ? "É só verificar sua caixa de entrada."
                  : "Seu email já foi confirmado. Você já pode entrar na conta."}
              </p>

              {resendState === "already_confirmed" && (
                <Button className="mt-4" onClick={() => navigate("/entrar")}>
                  Entrar
                </Button>
              )}
            </>
          ) : (
            <>
              <CircleX className="w-8 h-8 text-red-600 mx-auto mb-4" />

              <h1 className="text-2xl font-bold mb-2">
                Link expirado ou já usado
              </h1>

              <p className="text-muted-foreground mb-6">
                O link que você acessou já expirou ou foi usado. Solicite um
                novo abaixo.
              </p>

              <div className="flex flex-col items-center">
                <Input
                  type="email"
                  placeholder="Seu email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (resendState === "not_found") setResendState("idle");
                  }}
                />

                {resendState === "not_found" && (
                  <p className="text-sm text-red-500 text-left">
                    Este email não está cadastrado.
                  </p>
                )}

                <Button
                  type="button"
                  className="w-full mt-5"
                  disabled={resendState === "sending"}
                  onClick={handleResend}
                >
                  {resendState === "sending" ? (
                    <Spinner />
                  ) : (
                    "Solicitar novo link"
                  )}
                </Button>

                {resendError && (
                  <p className="text-sm text-red-500 mt-2">{resendError}</p>
                )}

                <Button variant="link" onClick={() => navigate("/entrar")}>
                  Entrar
                </Button>
                <Button variant="link" onClick={() => navigate("/cadastro")}>
                  Criar conta
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
