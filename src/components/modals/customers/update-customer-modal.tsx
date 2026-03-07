import { useEffect } from "react";
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
import { useState } from "react";
import type { Customer } from "@/types/customer";
import { maskPhone } from "@/utils/masked-input-phone";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Formato inválido: (XX) XXXXX-XXXX"),
});

type FormValues = z.infer<typeof formSchema>;

interface UpdateCustomerModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onUpdated: (customer: Customer) => void;
  onDeleted: (id: string) => void;
}

export function UpdateCustomerModal({
  open,
  customer,
  onClose,
  onUpdated,
  onDeleted,
}: UpdateCustomerModalProps) {
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { name: "", phone: "" },
  });

  useEffect(() => {
    if (!customer) return;
    Promise.resolve().then(() => {
      form.reset({ name: customer.name, phone: customer.phone });
    });
  }, [customer, form]);

  async function onSubmit(data: FormValues) {
    if (!customer) return;

    const success = await updateCustomer({
      id: customer.id,
      name: data.name,
      phone: data.phone,
    });

    if (!success) {
      toast.error(
        "Erro ao atualizar cliente. Verifique se o telefone já está cadastrado.",
      );
      return;
    }

    toast.success("Cliente atualizado!");
    onUpdated({ ...customer, name: data.name, phone: data.phone });
    onClose();
  }

  async function handleDelete() {
    if (!customer) return;
    setDeleting(true);
    const success = await deleteCustomer(customer.id);
    setDeleting(false);

    if (!success) {
      toast.error("Erro ao excluir cliente");
      return;
    }

    toast.success("Cliente excluído!");
    onDeleted(customer.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="mb-4">Editar cliente</DialogTitle>
        </DialogHeader>

        <form
          id="update-customer-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6 mb-4"
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
        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação não pode ser desfeita. O cliente será removido
                  permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
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

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="update-customer-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
