import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { updateCustomer } from "@/lib/supabase/customers/update-customer";
import { deleteCustomer } from "@/lib/supabase/customers/delete-customer";
import type { Customer } from "@/types/customer";
import { maskPhone } from "@/utils/mask-phone";
import { CustomerConflictModal } from "./customer-conflict-modal";
import { useBarbershopStore } from "@/store/barbershop.store";

const formSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio"),
  phone: z
    .string()
    .min(1, "Telefone e obrigatorio")
    .regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Formato inválido: (XX) XXXXX-XXXX"),
});

type FormValues = z.infer<typeof formSchema>;

interface UpdateCustomerModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onUpdated: (customer: Customer) => void;
  onDeleted: (id: string) => void;
  onEditExisting?: (customer: Customer) => void;
}

export function UpdateCustomerModal({
  open,
  customer,
  onClose,
  onUpdated,
  onDeleted,
  onEditExisting,
}: UpdateCustomerModalProps) {
  const { barbershop } = useBarbershopStore();
  const [deleting, setDeleting] = useState(false);
  const [conflictCustomer, setConflictCustomer] = useState<Customer | null>(
    null,
  );
  const [conflictOpen, setConflictOpen] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { name: "", phone: "" },
  });

  useEffect(() => {
    if (!customer) return;

    Promise.resolve().then(() => {
      form.reset({
        name: customer.name,
        phone: maskPhone(customer.phone ?? ""),
      });
    });
  }, [customer, form]);

  async function onSubmit(data: FormValues) {
    if (!customer || !barbershop?.id) return;

    const result = await updateCustomer({
      id: customer.id,
      barbershopId: barbershop.id,
      name: data.name,
      phone: data.phone,
    });

    if (result.status === "conflict") {
      if (result.existing) {
        setConflictCustomer(result.existing);
        setConflictOpen(true);
      } else {
        toast.error("Já existe outro cliente com este telefone.");
      }
      return;
    }

    if (result.status !== "updated") {
      toast.error("Erro ao atualizar cliente.");
      return;
    }

    toast.success("Cliente atualizado!");
    onUpdated(result.customer);
    onClose();
  }

  async function handleDelete() {
    if (!customer || !barbershop?.id) return;

    setDeleting(true);
    const result = await deleteCustomer(barbershop.id, customer.id);
    setDeleting(false);

    if (result.status === "conflict") {
      toast.error(
        `Este cliente possui ${result.future_appointments} agendamento(s) futuro(s).`,
      );
      return;
    }

    if (result.status !== "deleted") {
      toast.error("Erro ao excluir cliente.");
      return;
    }

    toast.success("Cliente excluido!");
    onDeleted(customer.id);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="mb-4">Editar cliente</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Editar cliente
          </DialogDescription>

          <form
            id="update-customer-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="mb-4 flex flex-col gap-6"
          >
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="update-customer-name">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="update-customer-name"
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
                    <FieldLabel htmlFor="update-customer-phone">
                      Telefone
                    </FieldLabel>
                    <Input
                      {...field}
                      id="update-customer-phone"
                      placeholder="(51) 99999-9999"
                      aria-invalid={fieldState.invalid}
                      onChange={event =>
                        field.onChange(maskPhone(event.target.value))
                      }
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>

          <DialogFooter className="flex-col items-between justify-between gap-5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-destructive mx-auto hover:text-destructive cursor-pointer"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação não pode ser desfeita. A exclusão será bloqueada
                    automaticamente caso existam agendamentos futuros.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {deleting ? "Excluindo..." : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div
              style={{ justifyContent: "space-between" }}
              className="flex gap-2"
            >
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-full w-26"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="update-customer-form"
                disabled={form.formState.isSubmitting}
                className="rounded-full w-32"
              >
                {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
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
        onEdit={existing => {
          setConflictOpen(false);
          setConflictCustomer(null);
          onClose();
          onEditExisting?.(existing);
        }}
        onDelete={async existing => {
          if (!barbershop?.id) return;

          const result = await deleteCustomer(barbershop.id, existing.id);

          if (result.status === "deleted") {
            setConflictOpen(false);
            setConflictCustomer(null);
            onDeleted(existing.id);
            toast.success(
              "Cliente excluido. Agora voce pode salvar novamente.",
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
