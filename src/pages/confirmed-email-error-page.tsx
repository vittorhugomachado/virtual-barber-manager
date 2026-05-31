import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router";
import { CircleX, Mail } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

type ResendState =
  | "idle"
  | "sending"
  | "not_found"
  | "already_confirmed"
  | "sent";

export function ConfirmationLinkEmailExpired() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [email, setEmail] = useState("");
  const [resendState, setResendState] = useState<ResendState>("idle");

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
      navigate("/");
    }
  }, [status, navigate]);

  async function handleResend() {
    if (!email) {
      toast.error("Informe seu email.");
      return;
    }

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
      options: { emailRedirectTo: `${window.location.origin}/confirmar-email` },
    });

    if (error) {
      setResendState("idle");
      toast.error("Erro ao reenviar.", { description: error.message });
      return;
    }

    setResendState("sent");
  }

  if (status === "loading" || status === "success") {
    return null;
  }

  if (resendState === "sent") {
    return (
      <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
        <Logo style="w-55 md:w-60 mb-8" />

        <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
            <Mail className="w-8 h-8 text-blue-500 mx-auto mb-4" />

            <h1 className="text-2xl font-bold mb-2">Email enviado</h1>

            <p className="text-muted-foreground">
              É só verificar sua caixa de entrada.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
      <Logo style="w-55 md:w-60 mb-8" />

      <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
          <CircleX className="w-8 h-8 text-red-600 mx-auto mb-4" />

          <h1 className="text-2xl font-bold mb-2">Link expirado ou já usado</h1>

          <p className="text-muted-foreground mb-6">
            O link que você acessou já expirou ou foi usado. Solicite um novo
            abaixo.
          </p>

          <div className="flex flex-col items-center">
            {resendState === "already_confirmed" ? (
              <>
                <p className="text-sm text-center text-green-600">
                  Seu email já foi confirmado. Você já pode entrar na conta.
                </p>
              </>
            ) : (
              <>
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
                  className="w-full mt-5 mb-2"
                  disabled={resendState === "sending"}
                  onClick={handleResend}
                >
                  {resendState === "sending" ? (
                    <Spinner />
                  ) : (
                    "Solicitar novo link"
                  )}
                </Button>
              </>
            )}

            <Button variant="link" onClick={() => navigate("/entrar")}>
              Entrar
            </Button>
            <Button variant="link" onClick={() => navigate("/cadastro")}>
              Já tenho conta
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
