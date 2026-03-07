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
import { createCustomer } from "@/lib/supabase/customers/create-customer";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Customer } from "@/types/customer";
import { maskPhone } from "@/utils/masked-input-phone";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(10, "Telefone inválido"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export function CreateCustomerModal({
  open,
  onClose,
  onCreated,
}: CreateCustomerModalProps) {
  const { barbershop } = useBarbershopStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { name: "", phone: "" },
  });

  async function onSubmit(data: FormValues) {
    if (!barbershop?.id) return;

    const result = await createCustomer({
      barbershopId: barbershop.id,
      name: data.name,
      phone: data.phone,
    });

    if (!result) {
      toast.error(
        "Erro ao criar cliente. Verifique se o telefone já está cadastrado.",
      );
      return;
    }

    toast.success("Cliente criado!");
    onCreated({
      id: result.id,
      barbershop_id: barbershop.id,
      name: data.name,
      phone: data.phone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    form.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="mb-4">Novo cliente</DialogTitle>
        </DialogHeader>

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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="create-customer-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Criando..." : "Criar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
