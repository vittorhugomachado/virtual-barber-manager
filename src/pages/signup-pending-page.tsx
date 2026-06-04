import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabase/supabase";
import { correctPendingEmail } from "@/lib/supabase/auth/correct-pending-email";
import { Mail, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useCredential } from "@/store/user-credential.store";

export function SignupPendingPage() {
  const navigate = useNavigate();
  const status = useCredential(state => state.status);
  const { email: emailParam } = useParams<{ email: string }>();
  const email = emailParam ? decodeURIComponent(emailParam) : "";

  // Usuário já autenticado não fica na tela de confirmação pendente.
  useEffect(() => {
    if (status === "authenticated") navigate("/painel", { replace: true });
  }, [status, navigate]);

  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Dados do cadastro pendente (gravados no signup). userId + changeToken são
  // o que autoriza corrigir o email sem sessão. Mantidos em state para suportar
  // mais de uma correção (o token é rotacionado a cada troca).
  const [pendingAuth, setPendingAuth] = useState<{
    userId: string;
    changeToken: string;
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem("pending-signup");
      if (!raw) return null;
      const p = JSON.parse(raw) as {
        userId?: string;
        changeToken?: string;
      };
      return p?.userId && p?.changeToken
        ? { userId: p.userId, changeToken: p.changeToken }
        : null;
    } catch {
      return null;
    }
  });

  // "Corrigir email": só disponível para cadastro recém-criado (tem token).
  const canCorrectEmail = Boolean(pendingAuth);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Corrige o email errado: troca via Edge Function e reenvia o link ao novo.
  async function handleCorrectEmail() {
    if (!pendingAuth || isSavingEmail) return;

    const target = newEmail.trim().toLowerCase();
    if (!target) {
      toast.error("Digite o novo email.");
      return;
    }
    if (target === email.toLowerCase()) {
      toast.error("O novo email é igual ao atual.");
      return;
    }

    setIsSavingEmail(true);
    try {
      const { newChangeToken } = await correctPendingEmail({
        userId: pendingAuth.userId,
        changeToken: pendingAuth.changeToken,
        newEmail: target,
      });

      // Persiste o novo email + token rotacionado.
      sessionStorage.setItem(
        "pending-signup",
        JSON.stringify({
          email: target,
          userId: pendingAuth.userId,
          changeToken: newChangeToken,
        }),
      );
      setPendingAuth({
        userId: pendingAuth.userId,
        changeToken: newChangeToken,
      });

      // Dispara o link de confirmação para o novo endereço (captcha do front).
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: {
          captchaToken: captchaToken ?? undefined,
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
        },
      });
      turnstileRef.current?.reset();
      setCaptchaToken(null);

      if (resendErr) {
        toast.success("Email corrigido!", {
          description:
            'Clique em "Reenviar email de confirmação" para receber o link.',
        });
      } else {
        toast.success("Email corrigido!", {
          description: `Enviamos um novo link para ${target}.`,
        });
        setCooldown(60);
      }

      setIsCorrecting(false);
      setNewEmail("");

      // Atualiza a URL para refletir o novo email.
      navigate(`/cadastro-pendente/${encodeURIComponent(target)}`, {
        replace: true,
        state: { email: target },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao corrigir email.",
      );
    } finally {
      setIsSavingEmail(false);
    }
  }

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
          <p className="font-medium text-foreground mb-2 break-all">{email}</p>

          {canCorrectEmail &&
            (isCorrecting ? (
              <div className="flex flex-col gap-2 mb-4 text-left">
                <Input
                  type="email"
                  placeholder="Digite o email correto"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  disabled={isSavingEmail}
                />
                <div className="flex flex-col items-center gap-2 mt-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleCorrectEmail}
                    disabled={isSavingEmail}
                  >
                    {isSavingEmail ? <Spinner /> : "Salvar e reenviar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsCorrecting(false);
                      setNewEmail("");
                    }}
                    disabled={isSavingEmail}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsCorrecting(true)}
                  className="mb-4 inline-flex items-center gap-1 text-sm text-[#0458EE] hover:underline mx-auto cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Digitou o email errado? Corrigir
                </button>
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
                </div>
              </>
            ))}
          <div className="flex flex-col items-center gap-3">
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
