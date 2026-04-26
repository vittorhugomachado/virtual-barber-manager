import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  PASSWORD_RECOVERY_STORAGE_KEY,
  supabase,
} from "@/lib/supabase/supabase";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CircleX, Eye, EyeOff } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import * as z from "zod";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua nova senha"),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type ResetPasswordStatus = "loading" | "valid" | "invalid" | "success";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ResetPasswordStatus>("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let active = true;
    let recoveryAccepted = false;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const code = searchParams.get("code");
    const type = searchParams.get("type") ?? hashParams.get("type");
    const tokenHash =
      searchParams.get("token_hash") ?? hashParams.get("token_hash");
    const hasRecoveryHash =
      type === "recovery" && Boolean(hashParams.get("access_token"));
    const hasRecoveryMarker = Boolean(
      sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY),
    );

    const markValid = () => {
      recoveryAccepted = true;
      window.history.replaceState({}, document.title, "/criar-nova-senha");
      if (active) setStatus("valid");
    };

    const markInvalid = async () => {
      await supabase.auth.signOut();
      sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
      if (active) setStatus("invalid");
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") {
        markValid();
      }
    });

    async function getRecoverySession() {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          return null;
        }

        if (data.session) {
          return data.session;
        }

        await new Promise(resolve => window.setTimeout(resolve, 250));
      }

      return null;
    }

    async function validateRecoveryLink() {
      if (!code && !tokenHash && !hasRecoveryHash && !hasRecoveryMarker) {
        await markInvalid();
        return;
      }

      if (tokenHash && type === "recovery") {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (!active) return;

        if (error || !data.session) {
          await markInvalid();
          return;
        }

        markValid();
        return;
      }

      if (code) {
        const currentSession = await getRecoverySession();

        if (!active) return;

        if (currentSession && hasRecoveryMarker) {
          markValid();
          return;
        }

        const { data, error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (!active) return;

        if (error || !data.session) {
          const session = await getRecoverySession();

          if (active && session && hasRecoveryMarker) {
            markValid();
            return;
          }

          await markInvalid();
          return;
        }

        markValid();
        return;
      }

      const session = await getRecoverySession();

      if (!active || recoveryAccepted) return;

      if (!session || (!hasRecoveryMarker && type !== "recovery")) {
        await markInvalid();
        return;
      }

      markValid();
    }

    void validateRecoveryLink();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(data: z.infer<typeof resetPasswordSchema>) {
    if (isLoading || status !== "valid") return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        const isSamePasswordError = error.message.includes(
          "New password should be different from the old password",
        );

        toast.error(
          isSamePasswordError
            ? "A nova senha precisa ser diferente da senha atual"
            : "Erro ao criar nova senha",
          {
            description: isSamePasswordError ? undefined : error.message,
          },
        );
        return;
      }

      await supabase.auth.signOut();
      sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
      setStatus("success");
      toast.success("Senha criada com sucesso. Faça login novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="w-full min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center gap-4 px-4">
        <Logo style="w-55 md:w-60" />
        <Spinner className="size-10" />
        <p className="text-muted-foreground">Validando link...</p>
      </main>
    );
  }

  if (status === "invalid") {
    return (
      <main className="w-full min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4">
        <Logo style="w-55 md:w-60 mb-8" />

        <Card className="w-full max-w-md text-center">
          <CardHeader className="items-center">
            <CircleX className="w-8 h-8 text-red-600 mb-2 mx-auto" />
            <CardTitle className="text-2xl">
              Link inválido ou expirado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Solicite um novo link de recuperação para criar uma nova senha.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              type="button"
              className="rounded-full"
              onClick={async () => {
                await supabase.auth.signOut();
                sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
                navigate("/esqueci-minha-senha");
              }}
            >
              Solicitar novo link
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="w-full min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4">
        <Logo style="w-55 md:w-60 mb-8" />

        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-4 dark:text-green-400" />
            <CardTitle className="text-2xl">
              Senha atualizada com sucesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Agora você pode entrar usando sua nova senha.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              type="button"
              className="rounded-full"
              onClick={() => navigate("/entrar")}
            >
              Fazer login
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-zinc-100 dark:bg-transparent flex items-center justify-center px-4 lg:justify-between lg:px-0">
      <Logo style="w-55 md:w-80 absolute top-8 lg:left-8" />
      <div className="hidden lg:block antonio text-5xl leading-snug max-w-xs">
        <h3 className="absolute bottom-8 left-4">
          Bem vindo a <strong className="text-[#0458EE]">Virtual</strong>!{" "}
          <br /> Gestão inteligente, <br />
          resultados reais
        </h3>
      </div>

      <div className="w-full max-w-lg lg:max-w-285 lg:flex lg:items-center justify-center lg:h-screen lg:w-[50vw] lg:bg-card text-card-foreground lg:border-l border-zinc-300 dark:border-none">
        <Card className="w-full max-w-lg lg:border-none lg:rounded-none lg:shadow-none">
          <CardHeader>
            <CardTitle className="lg:text-3xl lg:-translate-y-20">
              Criar nova senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              id="reset-password-form"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FieldGroup>
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reset-password-new">
                        Nova senha
                      </FieldLabel>
                      <div className="relative">
                        <Input
                          {...field}
                          id="reset-password-new"
                          type={showPassword ? "text" : "password"}
                          placeholder="mínimo 6 caracteres"
                          autoComplete="new-password"
                          aria-invalid={fieldState.invalid}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="confirmPassword"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reset-password-confirm">
                        Confirmar nova senha
                      </FieldLabel>
                      <div className="relative">
                        <Input
                          {...field}
                          id="reset-password-confirm"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="repita a nova senha"
                          autoComplete="new-password"
                          aria-invalid={fieldState.invalid}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              type="submit"
              form="reset-password-form"
              disabled={isLoading}
              className="w-full max-w-44 rounded-full"
            >
              {isLoading ? "Salvando..." : "Criar nova senha"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
