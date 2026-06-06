import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabase/supabase";
import { correctPendingEmail } from "@/lib/supabase/auth/correct-pending-email";
import {
  AlreadyConfirmedError,
  getPendingChangeToken,
} from "@/lib/supabase/auth/get-pending-change-token";
import {
  getResendCooldownRemaining,
  setResendCooldown,
} from "@/lib/supabase/auth/resend-cooldown";
import { Eye, EyeOff, Mail, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useCredential } from "@/store/user-credential.store";

export function SignupPendingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const status = useCredential(state => state.status);
  const { email: emailParam } = useParams<{ email: string }>();
  const email = emailParam ? decodeURIComponent(emailParam) : "";

  // Usuário já autenticado não fica na tela de confirmação pendente.
  useEffect(() => {
    if (status === "authenticated") navigate("/painel", { replace: true });
  }, [status, navigate]);

  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  // Inicializa do localStorage para o cooldown sobreviver a refresh.
  const [cooldown, setCooldown] = useState(() => getResendCooldownRemaining());
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

  // "Corrigir email": disponível imediatamente após cadastro (tem token no
  // sessionStorage) ou após verificar identidade no fluxo de login.
  const canCorrectEmail = Boolean(pendingAuth);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Verificação de identidade: o login form passa a senha via navigation state
  // (in-memory, some no reload). A página usa isso para verificar automaticamente
  // em background, sem pedir a senha de novo. Se falhar, oferece formulário manual.
  const navPassword =
    (location.state as { password?: string } | null)?.password ?? null;
  const [isAutoVerifying, setIsAutoVerifying] = useState(
    // Só inicia em auto-verificação se viemos do login (tem senha no state)
    // e ainda não temos o token.
    () => Boolean(navPassword) && !pendingAuth,
  );
  const [isVerifyingIdentity, setIsVerifyingIdentity] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Núcleo da verificação: aceita a senha como parâmetro para servir tanto o
  // fluxo automático (senha vinda do login) quanto o manual (campo de senha).
  async function verifyIdentityWith(password: string) {
    const freshToken = await getFreshCaptchaToken();
    const { userId, changeToken } = await getPendingChangeToken({
      email,
      password,
      captchaToken: freshToken,
    });

    const updatedPending = { email, userId, changeToken };
    sessionStorage.setItem("pending-signup", JSON.stringify(updatedPending));
    setPendingAuth({ userId, changeToken });

    turnstileRef.current?.reset();
    setCaptchaToken(null);
  }

  // Auto-verificação no mount: usa a senha do navigation state sem pedir ao
  // usuário. Se falhar silenciosamente, o formulário manual fica disponível.
  useEffect(() => {
    if (!navPassword || pendingAuth || !email) return;

    // Limpa a senha do history state imediatamente — uso único.
    window.history.replaceState(
      { ...window.history.state, usr: { email } },
      "",
    );

    setIsAutoVerifying(true);
    verifyIdentityWith(navPassword)
      .catch(() => {
        // Falha silenciosa: o link "Corrigir email" manual aparece no lugar.
      })
      .finally(() => setIsAutoVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intencionalmente sem deps: roda apenas no mount

  // Verificação manual (fallback se a auto-verificação falhou).
  async function handleVerifyIdentity() {
    if (!email || !verifyPassword || isVerifyingPassword) return;
    setIsVerifyingPassword(true);
    try {
      await verifyIdentityWith(verifyPassword);
      setIsVerifyingIdentity(false);
      setVerifyPassword("");
      setIsCorrecting(true);
    } catch (err) {
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      if (err instanceof AlreadyConfirmedError) {
        toast.success("Email já confirmado!", {
          description: "Você pode fazer login normalmente.",
        });
        navigate("/entrar");
        return;
      }
      toast.error(
        err instanceof Error ? err.message : "Erro ao verificar identidade.",
      );
    } finally {
      setIsVerifyingPassword(false);
    }
  }

  // Garante um token de captcha VÁLIDO sob demanda. O Turnstile invisível pode
  // estar com token expirado (~5 min) ou já consumido (uso único) — nesses casos
  // o state está null e o resend iria sem captcha, batendo 400 no GoTrue.
  // getResponsePromise resolve um token novo; com timeout para não travar a UI.
  async function getFreshCaptchaToken(): Promise<string | undefined> {
    if (captchaToken) return captchaToken;
    const instance = turnstileRef.current;
    if (!instance) return undefined;
    try {
      const token = await Promise.race([
        instance.getResponsePromise(),
        new Promise<undefined>(resolve =>
          setTimeout(() => resolve(undefined), 8000),
        ),
      ]);
      return token ?? undefined;
    } catch {
      return undefined;
    }
  }

  // Corrige o email errado: troca via Edge Function e reenvia o link ao novo.
  async function handleCorrectEmail() {
    if (!pendingAuth || isSavingEmail) return;

    // Durante o cooldown o reenvio cairia no rate-limit do GoTrue e falharia em
    // silêncio (email não sai, mas parece que saiu). Bloqueia a correção até lá.
    if (cooldown > 0) {
      toast.info(`Aguarde ${cooldown}s para corrigir e reenviar.`, {
        description: "O link anterior ainda é válido — confira o spam também.",
      });
      return;
    }

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
      const correctionToken = await getFreshCaptchaToken();
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: {
          captchaToken: correctionToken,
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
        },
      });
      turnstileRef.current?.reset();
      setCaptchaToken(null);

      if (resendErr) {
        // Email JÁ foi trocado com sucesso, mas o envio falhou. Não mascara como
        // sucesso total: avisa e, se for rate-limit, ativa o cooldown persistido.
        if (resendErr.message.includes("security purposes")) {
          const seconds = Number(
            resendErr.message.match(/after (\d+) seconds/)?.[1] ?? 60,
          );
          setCooldown(seconds);
          setResendCooldown(seconds);
        }
        toast.warning("Email corrigido, mas o link não foi enviado.", {
          description: `Aguarde o contador e clique em "Reenviar" para receber o link em ${target}.`,
        });
      } else {
        toast.success("Email corrigido!", {
          description: `Enviamos um novo link para ${target}.`,
        });
        setCooldown(60);
        setResendCooldown(60);
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

  // Guard de acesso: só entra quem chegou via LOGIN ou CADASTRO. Ambos gravam
  // um "pending-signup" em sessionStorage com este email. Acesso direto à URL
  // (sem esse marcador) é barrado, redirecionando ao login.
  useEffect(() => {
    if (!email) {
      navigate("/entrar", { replace: true });
      return;
    }
    try {
      const raw = sessionStorage.getItem("pending-signup");
      const prev = raw ? (JSON.parse(raw) as { email?: string }) : null;
      if (!prev?.email || prev.email.toLowerCase() !== email.toLowerCase()) {
        navigate("/entrar", { replace: true });
      }
    } catch {
      navigate("/entrar", { replace: true });
    }
  }, [email, navigate]);

  // Contador do cooldown. NÃO decrementa um número — recalcula o tempo restante
  // a partir do timestamp persistido (relógio real) a cada tick. Assim o tempo
  // corre mesmo com a aba em segundo plano (onde setInterval é estrangulado) ou
  // ao trocar de aba/janela. Também resincroniza ao voltar o foco/visibilidade.
  useEffect(() => {
    function sync() {
      setCooldown(prev => {
        const next = getResendCooldownRemaining();
        return next === prev ? prev : next; // evita re-render sem mudança
      });
    }
    sync();
    const id = setInterval(sync, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // Reenvio é SEMPRE manual (clique do usuário), para não colidir com o e-mail
  // que o cadastro acabou de disparar e cair no rate-limit do Supabase.
  async function handleResend() {
    if (!email || isResending || cooldown > 0) return;
    setIsResending(true);

    const freshToken = await getFreshCaptchaToken();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        captchaToken: freshToken,
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
        setResendCooldown(seconds);
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
    setResendCooldown(60);
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

          {/* Fluxo de correção de email — disponível após cadastro (token no
              sessionStorage) ou após verificar identidade no fluxo de login. */}
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
                    disabled={isSavingEmail || cooldown > 0}
                  >
                    {isSavingEmail ? (
                      <Spinner />
                    ) : cooldown > 0 ? (
                      `Aguarde ${cooldown}s`
                    ) : (
                      "Salvar e reenviar"
                    )}
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
              <button
                type="button"
                onClick={() => {
                  if (cooldown > 0) {
                    toast.info(`Aguarde ${cooldown}s para corrigir.`, {
                      description:
                        "O link anterior ainda é válido — confira o spam.",
                    });
                    return;
                  }
                  setIsCorrecting(true);
                }}
                disabled={cooldown > 0}
                className="mb-4 inline-flex items-center gap-1 text-sm text-[#0458EE] hover:underline mx-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
              >
                <Pencil className="h-3.5 w-3.5" />
                {cooldown > 0
                  ? `Corrigir email (aguarde ${cooldown}s)`
                  : "Digitou o email errado? Corrigir"}
              </button>
            ))}

          {/* Verificação de identidade: fluxo de login.
              Durante a auto-verificação não renderiza nada (acontece em silêncio).
              Se falhar, exibe o link manual que pede a senha como fallback. */}
          {!canCorrectEmail &&
            !isAutoVerifying &&
            (isVerifyingIdentity ? (
              <div className="flex flex-col gap-2 mb-4 text-left">
                <p className="text-sm text-muted-foreground text-center">
                  Para corrigir o email, confirme sua senha.
                </p>
                <div className="relative">
                  <Input
                    type={showVerifyPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={verifyPassword}
                    onChange={e => setVerifyPassword(e.target.value)}
                    disabled={isVerifyingPassword}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleVerifyIdentity();
                    }}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerifyPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    disabled={isVerifyingPassword}
                  >
                    {showVerifyPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2 mt-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleVerifyIdentity}
                    disabled={isVerifyingPassword || !verifyPassword}
                  >
                    {isVerifyingPassword ? <Spinner /> : "Confirmar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsVerifyingIdentity(false);
                      setVerifyPassword("");
                      setShowVerifyPassword(false);
                    }}
                    disabled={isVerifyingPassword}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsVerifyingIdentity(true)}
                className="mb-4 inline-flex items-center gap-1 text-sm text-[#0458EE] hover:underline mx-auto cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                Digitou o email errado? Corrigir
              </button>
            ))}

          {/* Aviso de spam + ações ficam ocultos só durante correção ou verificação
              manual. A auto-verificação em background não esconde esses controles. */}
          {!isCorrecting && !isVerifyingIdentity && (
            <>
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}
