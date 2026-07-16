import { useState } from "react";
import { Eye, EyeOff, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUpdateMember,
  type Member,
  type MemberRole,
} from "@/hooks/use-members";
import { useBarbershopStore } from "@/store/barbershop.store";

type EditMemberData = {
  username: string;
  password: string;
  role: MemberRole;
};

type UpdateMemberModalProps = {
  open: boolean;
  member: Member;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

const usernameSchema = z
  .string()
  .min(3, "Minimo 3 caracteres")
  .max(30, "Maximo 30 caracteres")
  .regex(/^[a-z0-9_]+$/, "Apenas letras minusculas, numeros e _");

function getRoleLabel(role: MemberRole) {
  return role === "admin" ? "Admin" : "Leitor";
}

function getRoleDescription(role: MemberRole) {
  return role === "admin" ? "Acesso completo" : "Apenas agenda";
}

export function UpdateMemberModal({
  open,
  member,
  onOpenChange,
  onUpdated,
}: UpdateMemberModalProps) {
  const { memberRole } = useBarbershopStore();
  const { updateMember } = useUpdateMember();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<EditMemberData>({
    username: member.username,
    password: "",
    role: member.role,
  });

  const usernameValidation = usernameSchema.safeParse(form.username);
  const usernameError =
    form.username.trim().length > 0 && !usernameValidation.success
      ? usernameValidation.error.issues[0]?.message
      : null;

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setShowPassword(false);
  }

  async function handleSubmit() {
    if (memberRole !== "owner") {
      toast.error("Apenas o proprietario pode editar usuários.");
      return;
    }

    if (!usernameSchema.safeParse(form.username).success) {
      toast.error(
        "O nome de usuário deve ter 3 a 30 caracteres e usar apenas letras minusculas, numeros e _.",
      );
      return;
    }

    if (
      form.password &&
      (form.password.length < 8 || form.password.length > 72)
    ) {
      toast.error("A nova senha deve ter entre 8 e 72 caracteres.");
      return;
    }

    const changes: Partial<EditMemberData> = {};

    if (form.username !== member.username) changes.username = form.username;
    if (form.password) changes.password = form.password;
    if (form.role !== member.role) changes.role = form.role;

    if (!changes.username && !changes.password && !changes.role) {
      toast.error("Nenhuma alteração detectada");
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateMember({ memberId: member.id, ...changes });
      toast.success(result?.message || "Membro atualizado com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o membro.",
      );
      return;
    } finally {
      setIsUpdating(false);
    }

    handleOpenChange(false);
    onUpdated();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar membro | @{member?.username}</DialogTitle>
            <DialogDescription className="sr-only">
              Atualize o nome de usuário, o perfil de acesso ou a senha do
              membro.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field data-invalid={!!usernameError}>
              <FieldLabel htmlFor="edit-username">Nome de usuário</FieldLabel>
              <Input
                id="edit-username"
                autoComplete="username"
                value={form.username}
                aria-invalid={!!usernameError}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    username: event.target.value.toLowerCase(),
                  }))
                }
                placeholder="Novo nome de usuário"
              />
              {usernameError && (
                <FieldError errors={[{ message: usernameError }]} />
              )}
            </Field>
            <div>
              <FieldLabel>Perfil de acesso</FieldLabel>
              <Select
                onValueChange={(role: MemberRole) =>
                  setForm(current => ({ ...current, role }))
                }
                value={form.role}
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
                {getRoleLabel(form.role)} — {getRoleDescription(form.role)}
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="edit-password">
                Nova senha (opcional)
              </FieldLabel>
              <div className="relative">
                <Input
                  id="edit-password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Deixe em branco para não alterar"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(value => !value)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-reverse-col gap-2 sm:flex-row items-center sm:justify-between">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="rounded-full w-26"
            >
              Cancelar
            </Button>
            <Button
              disabled={!!usernameError || isUpdating}
              onClick={handleSubmit}
              className="rounded-full w-35"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
