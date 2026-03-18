import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Shield, Eye, Trash2, Loader2, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "reader";
  username: string;
};

const formSchema = z.object({
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  role: z.enum(["admin", "reader"]),
});

type FormValues = z.infer<typeof formSchema>;

export function UsersSection() {
  const { barbershop } = useBarbershopStore();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { username: "", password: "", role: "reader" },
  });

  useEffect(() => {
    if (!barbershop) return;
    supabase
      .rpc("get_barbershop_members", { p_barbershop_id: barbershop.id })
      .then(({ data, error }) => {
        setMembers(!error && data ? (data as Member[]) : []);
      });
  }, [barbershop, fetchKey]);

  async function onSubmit(values: FormValues) {
    if (!barbershop) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await supabase.functions.invoke("create-member", {
      body: {
        username: values.username,
        password: values.password,
        role: values.role,
        barbershop_id: barbershop.id,
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (res.error) {
      let message = res.error.message;

      try {
        const errorBody = await res.error.context.json();
        message = errorBody?.error ?? message;

        if (errorBody?.error?.toLowerCase().includes("nome de usuário")) {
          form.setError("username", { message });
          return;
        }
      } catch {
        // mantém mensagem genérica se não conseguir ler o body
      }

      toast.error(message);
      return;
    }

    if (res.data?.error) {
      const message = res.data.error;

      if (message.toLowerCase().includes("nome de usuário")) {
        form.setError("username", { message });
        return;
      }

      toast.error(message);
      return;
    }

    toast.success("Usuário adicionado com sucesso.");
    form.reset();
    setDialogOpen(false);
    setFetchKey(k => k + 1);
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("delete-member", {
      body: { member_id: memberId },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error ?? res.error?.message);
    } else {
      toast.success("Usuário removido.");
      setMembers(prev => (prev ?? []).filter(m => m.id !== memberId));
    }
    setRemovingId(null);
  }

  return (
    <div className="w-full max-w-180 mx-16 mt-2 mb-8 flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Usuários</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie quem tem acesso ao painel da sua barbearia.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {members === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhum usuário adicionado ainda.
          </p>
        ) : (
          members.map(member => (
            <Card key={member.id}>
              <CardContent className="flex items-center justify-between px-5">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium truncate">
                    @{member.username}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {member.role === "admin" ? (
                      <>
                        <Shield className="h-3 w-3" /> Admin
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> Leitor
                      </>
                    )}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive cursor-pointer"
                    disabled={removingId === member.id}
                    onClick={() => handleRemove(member.id)}
                  >
                    {removingId === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button
        variant="outline"
        className="w-fit cursor-pointer"
        onClick={() => setDialogOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Novo usuário
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open);
          if (!open) {
            form.reset();
            setShowPassword(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>

          <form
            id="add-member-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4 mb-2"
          >
            <FieldGroup>
              <Controller
                name="username"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="member-username">
                      Nome de usuário
                    </FieldLabel>
                    <Input
                      {...field}
                      id="member-username"
                      placeholder="ex: joao_silva"
                      aria-invalid={fieldState.invalid}
                      onChange={e =>
                        field.onChange(e.target.value.toLowerCase())
                      }
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
                    <FieldLabel htmlFor="member-password">Senha</FieldLabel>
                    <div className="relative">
                      <Input
                        {...field}
                        id="member-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        aria-invalid={fieldState.invalid}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(v => !v)}
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
                name="role"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Perfil de acesso</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin — acesso completo
                          </div>
                        </SelectItem>
                        <SelectItem value="reader">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Leitor — apenas agenda
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="add-member-form"
              disabled={form.formState.isSubmitting}
              className="cursor-pointer rounded-full"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
