import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type Resolver, useForm } from "react-hook-form";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateMember,
  type Member,
  type MemberRole,
} from "@/hooks/use-members";
import { useBarbershopStore } from "@/store/barbershop.store";

type CreateMemberData = {
  username: string;
  password: string;
  role: MemberRole;
};

type CreateMemberModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (member: Member) => void;
};

const createMemberSchema = z.object({
  username: z
    .string()
    .min(3, "Minimo 3 caracteres")
    .max(30, "Maximo 30 caracteres")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minusculas, numeros e _"),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres")
    .max(72, "A senha deve ter no máximo 72 caracteres"),
  role: z.enum(["admin", "reader"]),
});

export function CreateMemberModal({
  open,
  onOpenChange,
  onCreated,
}: CreateMemberModalProps) {
  const { barbershop, memberRole } = useBarbershopStore();
  const { createMember } = useCreateMember();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<CreateMemberData>({
    resolver: zodResolver(createMemberSchema) as Resolver<CreateMemberData>,
    defaultValues: { username: "", password: "", role: "reader" },
  });

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      form.reset();
      setShowPassword(false);
    }
  }

  async function handleSubmit(values: CreateMemberData) {
    if (!barbershop || memberRole !== "owner") {
      toast.error("Apenas o proprietario pode adicionar usuários.");
      return;
    }

    let createdMember: Member;
    try {
      const result = await createMember({
        barbershopId: barbershop.id,
        username: values.username,
        password: values.password,
        role: values.role,
      });
      createdMember = result.member as Member;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível adicionar.";

      if (message.toLowerCase().includes("nome de usuário")) {
        form.setError("username", { message });
        return;
      }

      toast.error(message);
      return;
    }

    toast.success("Usuário adicionado com sucesso.");
    handleOpenChange(false);
    onCreated(createdMember);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {open && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Criar novo usuário
          </DialogDescription>
          <form
            id="add-member-form"
            onSubmit={form.handleSubmit(handleSubmit)}
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
                      autoComplete="username"
                      placeholder="ex: joao_silva"
                      aria-invalid={fieldState.invalid}
                      onChange={event =>
                        field.onChange(event.target.value.toLowerCase())
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
                        autoComplete="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        aria-invalid={fieldState.invalid}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(value => !value)}
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

          <DialogFooter className="flex flex-reverse-col gap-2 sm:flex-row items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="rounded-full w-26"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="add-member-form"
              disabled={form.formState.isSubmitting}
              className="cursor-pointer rounded-full w-32"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
