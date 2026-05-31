import { supabase } from "@/lib/supabase/supabase";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import * as z from "zod";

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
import { useRef, useState } from "react";
import { maskPhone } from "@/utils/mask-phone";
import { Eye, EyeOff } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const formSchema = z.object({
  name: z.string().min(1, "Digite seu nome"),
  phone: z
    .string()
    .refine(v => v.replace(/\D/g, "").length === 11, "Celular inválido"),
  barbershopName: z
    .string()
    .min(1, "Digite o nome da barbearia")
    .max(30, "Nome deve ter no máximo 30 caracteres"),
  email: z.email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const mensagens: Record<string, string> = {
  "User already registered": "Este email já está cadastrado",
  "Password should be at least 6 characters":
    "Senha deve ter no mínimo 6 caracteres",
  "email rate limit exceeded": "Muitas tentativas, aguarde alguns minutos",
};

export function SignupForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      barbershopName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    if (isLoading) return;
    if (!captchaToken) {
      toast.error("Confirme que você não é um robô.");
      return;
    }
    setIsLoading(true);
    console.log(captchaToken);
    const rawPhone = data.phone.replace(/\D/g, "");
    const signupChangeToken = crypto.randomUUID();

    try {
      // verifica celular duplicado
      const { data: existingPhone } = await supabase.rpc("check_phone_exists", {
        p_phone: rawPhone,
      });

      if (existingPhone) {
        form.setError("phone", { message: "Este celular já está cadastrado" });
        return;
      }

      // verifica email duplicado
      const { data: existingEmail } = await supabase.rpc("check_email_exists", {
        p_email: data.email,
      });

      if (existingEmail) {
        form.setError("email", { message: "Este email já está cadastrado" });
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          captchaToken: captchaToken!,
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
          data: {
            role: "barbershop",
            name: data.name,
            phone: rawPhone,
            barbershop_name: data.barbershopName,
            signup_change_token: signupChangeToken,
          },
        },
      });

      if (authError) {
        turnstileRef.current?.reset();
        setCaptchaToken(null);
        const mensagem =
          Object.entries(mensagens).find(([key]) =>
            authError.message.includes(key),
          )?.[1] ?? "Erro ao criar conta";
        toast.error(mensagem);
        return;
      }

      if (!authData.user) {
        toast.error("Erro ao criar conta", {
          description: "Tente novamente em instantes.",
        });
        return;
      }

      const userId = authData.user.id;

      toast.success("Conta criada com sucesso!");
      const pendingSignup = {
        email: data.email,
        userId: userId,
        changeToken: signupChangeToken,
      };

      sessionStorage.setItem("pending-signup", JSON.stringify(pendingSignup));
      navigate("/entrar", { state: pendingSignup });
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <div className="w-full max-w-lg pt-24 pb-16 lg:max-w-285 lg:flex lg:items-center justify-center lg:min-h-screen lg:w-[50vw] lg:bg-card text-card-foreground lg:border-l border-zinc-300 dark:border-none">
      <Card className="w-full max-w-lg lg:border-none lg:rounded-none lg:shadow-none">
        <CardHeader>
          <CardTitle className="lg:text-3xl lg:-translate-y-20">
            Criar conta na Virtual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form id="signup-form" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <FieldGroup>
                  <Controller
                    name="barbershopName"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="signup-form-barbershop">
                          Nome da barbearia
                        </FieldLabel>
                        <Input
                          {...field}
                          id="signup-form-barbershop"
                          aria-invalid={fieldState.invalid}
                          placeholder="Barbearia do João"
                          maxLength={30}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="signup-form-name">
                          Nome do proprietário
                        </FieldLabel>
                        <Input
                          {...field}
                          id="signup-form-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Seu nome"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="phone"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="signup-form-phone">
                          Celular
                        </FieldLabel>
                        <Input
                          {...field}
                          id="signup-form-phone"
                          aria-invalid={fieldState.invalid}
                          placeholder="(00) 00000-0000"
                          inputMode="numeric"
                          onChange={e =>
                            field.onChange(maskPhone(e.target.value))
                          }
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="signup-form-email">
                          Email
                        </FieldLabel>
                        <Input
                          {...field}
                          id="signup-form-email"
                          aria-invalid={fieldState.invalid}
                          placeholder="barbearia@email.com"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="password"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="signup-form-password">
                          Senha
                        </FieldLabel>
                        <div className="relative">
                          <Input
                            {...field}
                            id="signup-form-password"
                            type={showPassword ? "text" : "password"}
                            aria-invalid={fieldState.invalid}
                            placeholder="mínimo 6 caracteres"
                            autoComplete="off"
                            className="pr-9"
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
                </FieldGroup>
              </div>
            </div>
          </form>

          <div className="flex flex-col items-center mt-4">
            {captchaFailed ? (
              <div className="text-center">
                <p className="text-sm text-red-500 mb-2">
                  Verificação de segurança indisponível.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Recarregar página
                </Button>
              </div>
            ) : (
              <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={token => {
                  setCaptchaToken(token);
                  setCaptchaFailed(false);
                }}
                onExpire={() => setCaptchaToken(null)}
                onError={() => {
                  setCaptchaToken(null);
                  setCaptchaFailed(true);
                }}
                options={{ theme: "auto", language: "pt-br" }}
              />
            )}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button type="submit" form="signup-form" disabled={isLoading}>
            {isLoading ? "Criando conta..." : "Criar conta"}
          </Button>
          <Button variant="link" onClick={() => navigate("/entrar")}>
            Já tenho conta
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
