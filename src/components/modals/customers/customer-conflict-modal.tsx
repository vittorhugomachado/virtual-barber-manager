import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { Trash2 } from "lucide-react";
import { maskPhone } from "@/utils/masked-input-phone";
import type { Customer } from "@/types/customer";
import { useFutureAppointmentsCount } from "@/hooks/use-future-appointments-count";

interface CustomerConflictModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export function CustomerConflictModal({
  open,
  customer,
  onClose,
  onEdit,
  onDelete,
}: CustomerConflictModalProps) {
  const customerField =
    customer?.source === "customers_auth" ? "customer_id" : "manual_customer_id";
  const { count: futureCount, loading: countLoading } =
    useFutureAppointmentsCount(
      customerField,
      open ? (customer?.id ?? null) : null,
    );

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Cliente já cadastrado</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Já existe um cliente com esse celular
        </DialogDescription>
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-muted-foreground">
            Já existe um cliente com esse número de celular:
          </p>

          <div className="flex flex-col gap-1 p-4 rounded-lg border">
            <span className="font-semibold">{customer.name}</span>
            <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {customer.phone ? maskPhone(customer.phone) : "Sem telefone"}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Deseja editar o cliente existente ou excluí-lo?
          </p>
        </div>

        <DialogFooter className="flex-row flex-wrap items-center justify-center gap-2 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir cliente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {!countLoading && futureCount > 0
                    ? "Conflito com agenda"
                    : "Excluir cliente?"}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="flex flex-col gap-2 mt-2">
                    {!countLoading && futureCount > 0 ? (
                      <span className="text-orange-500 font-medium">
                        ⚠️ Existem {futureCount} agendamento
                        {futureCount !== 1 ? "s" : ""} futuro
                        {futureCount !== 1 ? "s" : ""} vinculado
                        {futureCount !== 1 ? "s" : ""} a este cliente.
                        Cancele-os antes de excluir.
                      </span>
                    ) : (
                      <span>
                        Essa ação não pode ser desfeita. O cliente será removido
                        permanentemente.
                      </span>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                {futureCount === 0 && (
                  <AlertDialogAction
                    onClick={() => onDelete(customer)}
                    disabled={countLoading}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex flex-2 gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => onEdit(customer)}>
              Editar cliente
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
