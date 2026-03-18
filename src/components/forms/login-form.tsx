import { useState } from "react";
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

const ownerSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

const memberSchema = z.object({
  username: z.string().min(1, "Digite seu nome de usuário"),
  password: z.string().min(1, "Digite sua senha"),
});

const errorMessages: Record<string, string> = {
  "Invalid login credentials": "Usuário ou senha incorretos",
  "Email not confirmed": "Email não confirmado",
  "Too many requests": "Muitas tentativas, aguarde um momento",
};

export function LoginForm() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"owner" | "member">("owner");

  const ownerForm = useForm<z.infer<typeof ownerSchema>>({
    resolver: zodResolver(ownerSchema),
    defaultValues: { email: "", password: "" },
  });

  const memberForm = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onOwnerSubmit(data: z.infer<typeof ownerSchema>) {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        toast.error(errorMessages[error.message] ?? "Erro ao fazer login");
        return;
      }
      navigate("/painel");
    } finally {
      setIsLoading(false);
    }
  }

  async function onMemberSubmit(data: z.infer<typeof memberSchema>) {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // Busca o email interno pelo username
      const { data: rows, error: lookupError } = await supabase.rpc(
        "get_member_auth_email",
        { p_username: data.username.toLowerCase() },
      );

      if (lookupError || !rows || rows.length === 0) {
        toast.error("Usuário não encontrado");
        return;
      }

      // Se tiver mais de uma barbearia com esse username, usa a primeira
      // (em cenários futuros pode-se exibir um seletor)
      const internalEmail = rows[0].internal_email;

      const { error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: data.password,
      });

      if (error) {
        toast.error(
          errorMessages[error.message] ?? "Usuário ou senha incorretos",
        );
        return;
      }

      navigate("/painel");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg lg:max-w-285 lg:flex lg:items-center justify-center lg:h-screen lg:w-[50vw] lg:bg-card text-card-foreground lg:border-l border-zinc-300 dark:border-none">
      <Card className="w-full max-w-lg lg:border-none lg:rounded-none lg:shadow-none">
        <CardHeader>
          <CardTitle className="lg:text-3xl lg:-translate-y-20">
            Entrar na Virtual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Toggle de modo */}
          <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setMode("owner")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                mode === "owner"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Proprietário
            </button>
            <button
              type="button"
              onClick={() => setMode("member")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                mode === "member"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Colaborador
            </button>
          </div>

          {mode === "owner" ? (
            <div key="owner-mode">
              <form
                id="login-form-owner"
                onSubmit={ownerForm.handleSubmit(onOwnerSubmit)}
              >
                <FieldGroup>
                  <Controller
                    name="email"
                    control={ownerForm.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="login-email">Email</FieldLabel>
                        <Input
                          {...field}
                          id="login-email"
                          placeholder="barbearia@email.com"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="password"
                    control={ownerForm.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="login-password">Senha</FieldLabel>
                        <Input
                          {...field}
                          type="password"
                          id="login-password"
                          placeholder="sua senha"
                          autoComplete="off"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>

              <CardFooter className="flex-col gap-2 mt-6">
                <Button
                  type="submit"
                  form="login-form-owner"
                  disabled={isLoading}
                  className="w-full max-w-36"
                >
                  {isLoading ? "Entrando..." : "Login"}
                </Button>

                <Button variant="link" onClick={() => navigate("/cadastro")}>
                  Criar conta
                </Button>
              </CardFooter>
            </div>
          ) : (
            <div key="member-mode">
              <form
                id="login-form-member"
                onSubmit={memberForm.handleSubmit(onMemberSubmit)}
              >
                <FieldGroup>
                  <Controller
                    name="username"
                    control={memberForm.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="login-username">
                          Nome de usuário
                        </FieldLabel>
                        <Input
                          {...field}
                          id="login-username"
                          placeholder="ex: joao_silva"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Controller
                    name="password"
                    control={memberForm.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="login-member-password">
                          Senha
                        </FieldLabel>
                        <Input
                          {...field}
                          type="password"
                          id="login-member-password"
                          placeholder="sua senha"
                          autoComplete="off"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>

              <CardFooter className="flex-col gap-2 mt-6">
                <Button
                  type="submit"
                  form="login-form-member"
                  disabled={isLoading}
                  className="w-full max-w-36"
                >
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </CardFooter>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
