import { supabase } from "@/lib/supabase";
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

const formSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

export function LoginForm() {
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      const mensagens: Record<string, string> = {
        "Invalid login credentials": "Email ou senha incorretos",
        "Email not confirmed": "Email não confirmado",
        "Too many requests": "Muitas tentativas, aguarde um momento",
      };

      const mensagem = mensagens[error.message] ?? "Erro ao fazer login";

      toast.error(mensagem);
      return;
    }

    navigate("/painel");
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
          <form id="login-form" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <FieldGroup>
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="login-form-email">
                          Email
                        </FieldLabel>
                        <Input
                          {...field}
                          id="login-form-email"
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
                        <FieldLabel htmlFor="login-form-password">
                          Senha
                        </FieldLabel>
                        <Input
                          {...field}
                          type="password"
                          id="login-form-password"
                          aria-invalid={fieldState.invalid}
                          placeholder="sua senha"
                          autoComplete="off"
                        />
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
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button type="submit" form="login-form" className="w-full max-w-xs">
            Login
          </Button>
          <Button variant="link">Criar conta</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
