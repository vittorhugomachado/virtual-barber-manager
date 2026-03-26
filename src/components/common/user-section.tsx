import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Plus,
  Shield,
  Eye,
  Trash2,
  Loader2,
  EyeOff,
  Pencil,
  CircleHelp,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "reader";
  username: string;
};

type EditMemberData = {
  username?: string;
  password?: string;
  role?: "admin" | "reader";
};

type CreateMemberData = {
  username: string;
  password: string;
  role: "admin" | "reader";
};

const usernameSchema = z
  .string()
  .min(3, "Minimo 3 caracteres")
  .max(30, "Maximo 30 caracteres")
  .regex(/^[a-z0-9_]+$/, "Apenas letras minusculas, numeros e _");

function getRoleLabel(role: "admin" | "reader") {
  return role === "admin" ? "Admin" : "Leitor";
}

function getRoleDescription(role: "admin" | "reader") {
  return role === "admin" ? "Acesso completo" : "Apenas agenda";
}

function getRoleHelpText(role: "admin" | "reader") {
  return role === "admin"
    ? "Acesso total, com exceção das configurações."
    : "Acesso restrito apenas a agenda.";
}

function RoleHelpIcon({ role }: { role: "admin" | "reader" }) {
  const text = getRoleHelpText(role);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Explicar permissao ${getRoleLabel(role)}`}
            className="hidden md:inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56 text-xs">
          {text}
        </TooltipContent>
      </Tooltip>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Explicar permissao ${getRoleLabel(role)}`}
            className="inline-flex md:hidden h-5 w-5 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <PopoverHeader>
            <PopoverTitle>{getRoleLabel(role)}</PopoverTitle>
            <PopoverDescription className="text-sm">{text}</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </>
  );
}

export function UsersSection() {
  const { barbershop, memberRole } = useBarbershopStore();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<{
    username: string;
    password: string;
    role: "admin" | "reader";
  }>({
    username: "",
    password: "",
    role: "reader",
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const editUsernameValidation = usernameSchema.safeParse(editForm.username);
  const editUsernameError =
    editForm.username.trim().length > 0 && !editUsernameValidation.success
      ? editUsernameValidation.error.issues[0]?.message
      : null;

  const form = useForm<CreateMemberData>({
    resolver: zodResolver(
      z.object({
        username: usernameSchema,
        password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
        role: z.enum(["admin", "reader"]),
      }),
    ) as Resolver<CreateMemberData>,
    defaultValues: { username: "", password: "", role: "reader" },
  });

  useEffect(() => {
    if (!barbershop?.id) return;
    let mounted = true;

    supabase
      .rpc("get_barbershop_members", { p_barbershop_id: barbershop.id })
      .then(({ data, error }) => {
        if (!mounted) return;
        setMembers(!error && data ? (data as Member[]) : []);
      });

    return () => {
      mounted = false;
    };
  }, [barbershop?.id, fetchKey]);

  async function getAccessToken() {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    if (refreshed.session?.access_token) {
      return refreshed.session.access_token;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session?.access_token) {
      throw refreshError ?? new Error("Sessao expirada. Entre novamente.");
    }

    return session.access_token;
  }

  async function handleCreateMember(values: CreateMemberData) {
    if (!barbershop || memberRole !== "owner") {
      toast.error("Apenas o proprietario pode adicionar usuarios.");
      return;
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Sessao expirada. Entre novamente.",
      );
      return;
    }

    const res = await supabase.functions.invoke("create-member", {
      body: {
        username: values.username,
        password: values.password,
        role: values.role,
        barbershop_id: barbershop.id,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    setShowCreateDialog(false);
    setFetchKey(k => k + 1);
  }

  async function handleRemoveMember(memberId: string) {
    if (memberRole !== "owner") {
      toast.error("Apenas o proprietario pode remover usuarios.");
      return;
    }

    setRemovingId(memberId);
    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Sessao expirada. Entre novamente.",
      );
      setRemovingId(null);
      return;
    }
    const res = await supabase.functions.invoke("delete-member", {
      body: { member_id: memberId },
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

  async function handleEditMember(values: EditMemberData) {
    if (!editMember || memberRole !== "owner") {
      toast.error("Apenas o proprietario pode editar usuarios.");
      return;
    }

    if (values.username && !usernameSchema.safeParse(values.username).success) {
      toast.error(
        "O nome de usuario deve ter 3 a 30 caracteres e usar apenas letras minusculas, numeros e _.",
      );
      return;
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Sessao expirada. Entre novamente.",
      );
      return;
    }

    const body: EditMemberData & { member_id: string } = {
      member_id: editMember.user_id,
    };

    if (values.username && values.username !== editMember.username) {
      body.username = values.username;
    }

    if (values.password && values.password.length >= 6) {
      body.password = values.password;
    }

    if (values.role && values.role !== editMember.role) {
      body.role = values.role;
    }

    // Se não tiver nada para atualizar
    if (!body.username && !body.password && !body.role) {
      toast.error("Nenhuma alteração detectada");
      return;
    }

    const res = await supabase.functions.invoke("update-member", {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error ?? res.error?.message);
      return;
    }

    toast.success(res.data?.message || "Membro atualizado com sucesso!");
    setEditMember(null);
    setShowEditDialog(false);
    setFetchKey(k => k + 1);
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="w-full max-w-180 mx-16 mt-2 mb-8 px-3 flex flex-col gap-4">
        <div className="px-3">
          <h2 className="text-xl font-semibold">Usuários</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie quem tem acesso ao painel da sua barbearia.
          </p>
        </div>

        {memberRole !== "owner" && (
          <p className="px-3 text-sm text-muted-foreground">
            Apenas o proprietario da barbearia pode gerenciar usuarios.
          </p>
        )}

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
                <CardContent className="flex flex-col sm:flex-row sm:justify-between items-center justify-center px-5">
                  <div className="flex flex-col items-center sm:items-start gap-0.5 mb-2 sm:mb-0 min-w-0">
                    <span className="font-medium truncate">
                      @{member.username}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 ml-4">
                    <Badge
                      variant="secondary"
                      className="flex min-w-24 items-center justify-center gap-1 font-medium"
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
                      <RoleHelpIcon role={member.role} />
                    </Badge>
                    <div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => {
                          setEditMember(member);
                          setEditForm({
                            username: member.username,
                            password: "",
                            role: member.role,
                          });
                          setShowEditDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive cursor-pointer"
                        disabled={removingId === member.id}
                        onClick={() => setConfirmRemove(member)}
                      >
                        {removingId === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Button
          variant="outline"
          className="w-fit cursor-pointer"
          disabled={memberRole !== "owner"}
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo usuário
        </Button>

        {/* Dialog de criação de usuário */}
        <Dialog
          open={showCreateDialog}
          onOpenChange={open => {
            setShowCreateDialog(open);
            if (!open) {
              form.reset();
              setShowCreatePassword(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar usuário</DialogTitle>
            </DialogHeader>

            <form
              id="add-member-form"
              onSubmit={form.handleSubmit(handleCreateMember)}
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
                          type={showCreatePassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          aria-invalid={fieldState.invalid}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowCreatePassword(v => !v)}
                          tabIndex={-1}
                        >
                          {showCreatePassword ? (
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
                onClick={() => setShowCreateDialog(false)}
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

        {/* Dialog de edição de usuário */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar membro — @{editMember?.username}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Field data-invalid={!!editUsernameError}>
                <FieldLabel htmlFor="edit-username">Nome de usuário</FieldLabel>
                <Input
                  id="edit-username"
                  value={editForm.username}
                  aria-invalid={!!editUsernameError}
                  onChange={e =>
                    setEditForm({
                      ...editForm,
                      username: e.target.value.toLowerCase(),
                    })
                  }
                  placeholder="Novo nome de usuário"
                />
                {editUsernameError && (
                  <FieldError errors={[{ message: editUsernameError }]} />
                )}
              </Field>
              <div>
                <FieldLabel>Perfil de acesso</FieldLabel>
                <Select
                  onValueChange={(value: "admin" | "reader") =>
                    setEditForm({ ...editForm, role: value })
                  }
                  value={editForm.role}
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {getRoleLabel(editForm.role)} —{" "}
                  {getRoleDescription(editForm.role)}
                </p>
              </div>
              <div>
                <FieldLabel htmlFor="edit-password">
                  Nova senha (opcional)
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={e =>
                      setEditForm({ ...editForm, password: e.target.value })
                    }
                    placeholder="Deixe em branco para não alterar"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                    onClick={() => setShowEditPassword(v => !v)}
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={!!editUsernameError}
                onClick={() => handleEditMember(editForm)}
              >
                Salvar alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmação de remoção */}
        <AlertDialog
          open={!!confirmRemove}
          onOpenChange={open => {
            if (!open) setConfirmRemove(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover{" "}
                <strong>@{confirmRemove?.username}</strong>? Ele perderá o
                acesso ao painel imediatamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (confirmRemove) {
                    handleRemoveMember(confirmRemove.id);
                    setConfirmRemove(null);
                  }
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
