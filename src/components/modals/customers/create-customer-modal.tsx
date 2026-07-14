import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createCustomer } from "@/lib/supabase/customers/create-customer";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Customer } from "@/types/customer";
import { maskPhone } from "@/utils/mask-phone";
import { useState } from "react";
import { CustomerConflictModal } from "./customer-conflict-modal";
import { deleteCustomer } from "@/lib/supabase/customers/delete-customer";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(10, "Telefone inválido"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
  onEditExisting?: (customer: Customer) => void;
  onDeleted?: (id: string) => void;
}

export function CreateCustomerModal({
  open,
  onClose,
  onCreated,
  onEditExisting,
  onDeleted,
}: CreateCustomerModalProps) {
  const { barbershop } = useBarbershopStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { name: "", phone: "" },
  });
  const [conflictCustomer, setConflictCustomer] = useState<Customer | null>(
    null,
  );
  const [conflictOpen, setConflictOpen] = useState(false);

  async function onSubmit(data: FormValues) {
    if (!barbershop?.id) return;

    const result = await createCustomer({
      barbershopId: barbershop.id,
      name: data.name,
      phone: data.phone,
    });

    if (result.status === "conflict") {
      setConflictCustomer(result.existing);
      setConflictOpen(true);
      return;
    }

    if (result.status === "error") {
      toast.error("Erro ao criar cliente.");
      return;
    }

    if (result.status === "invalid") {
      toast.error(
        result.field === "phone" ? "Telefone inválido." : "Nome inválido.",
      );
      return;
    }

    toast.success("Cliente criado!");
    onCreated(result.customer);
    form.reset();
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="mb-4">Novo cliente</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Criar novo cliente
          </DialogDescription>
          <form
            id="create-customer-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-6 mb-4"
          >
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="create-customer-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="create-customer-name"
                      placeholder="Nome do cliente"
                      aria-invalid={fieldState.invalid}
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
                    <FieldLabel htmlFor="create-customer-phone">
                      Telefone
                    </FieldLabel>
                    <Input
                      {...field}
                      id="create-customer-phone"
                      placeholder="(51) 99999-9999"
                      aria-invalid={fieldState.invalid}
                      onChange={e => field.onChange(maskPhone(e.target.value))}
                    />
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
              onClick={onClose}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-customer-form"
              disabled={form.formState.isSubmitting}
              className="rounded-full"
            >
              {form.formState.isSubmitting ? "Criando..." : "Criar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CustomerConflictModal
        open={conflictOpen}
        customer={conflictCustomer}
        onClose={() => {
          setConflictOpen(false);
          setConflictCustomer(null);
        }}
        onEdit={customer => {
          setConflictOpen(false);
          setConflictCustomer(null);
          onClose();
          onEditExisting?.(customer);
        }}
        onDelete={async customer => {
          if (!barbershop?.id) return;

          const result = await deleteCustomer(barbershop.id, customer.id);
          if (result.status === "deleted") {
            setConflictOpen(false);
            setConflictCustomer(null);
            onDeleted?.(customer.id);
            toast.success(
              "Cliente excluído. Agora você pode cadastrar novamente.",
            );
            return;
          }

          if (result.status === "conflict") {
            toast.error(
              `Este cliente possui ${result.future_appointments} agendamento(s) futuro(s).`,
            );
            return;
          }

          toast.error("Erro ao excluir cliente.");
        }}
      />
    </>
  );
}
