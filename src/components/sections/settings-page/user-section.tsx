import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Shield, Eye, Trash2, Loader2 } from "lucide-react";
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
  name: string;
  email: string;
};

const formSchema = z.object({
  email: z.string().min(1, "Email é obrigatório"),
  role: z.enum(["admin", "reader"]),
});

type FormValues = z.infer<typeof formSchema>;

export function UsersSection() {
  const { barbershop } = useBarbershopStore();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { email: "", role: "reader" },
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
    const { error } = await supabase.rpc("add_member_by_email", {
      p_email: values.email,
      p_role: values.role,
      p_barbershop_id: barbershop.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Usuário adicionado com sucesso.");
    form.reset();
    setDialogOpen(false);
    setFetchKey(k => k + 1);
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    const { error } = await supabase.rpc("remove_member", {
      p_member_id: memberId,
    });

    if (error) {
      toast.error(error.message);
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
                  <span className="font-medium truncate">{member.name}</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {member.email}
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
          if (!open) form.reset();
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
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="member-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="member-email"
                      type="email"
                      placeholder="email@exemplo.com"
                      aria-invalid={fieldState.invalid}
                    />
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
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="add-member-form"
              disabled={form.formState.isSubmitting}
              className="cursor-pointer"
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
