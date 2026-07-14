import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Trash2 } from "lucide-react";
import { maskPhone } from "@/utils/mask-phone";
import type { Customer } from "@/types/customer";

interface CustomerConflictModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => Promise<void>;
}

export function CustomerConflictModal({
  open,
  customer,
  onClose,
  onEdit,
  onDelete,
}: CustomerConflictModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!customer) return null;

  const isManualCustomer = customer.source === "customers";

  async function handleDelete() {
    if (!customer) return;
    setDeleting(true);
    try {
      await onDelete(customer);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
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
          <div className="flex flex-col gap-1 rounded-lg border p-4">
            <span className="font-semibold">{customer.name}</span>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {customer.phone ? maskPhone(customer.phone) : "Sem telefone"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {isManualCustomer
              ? "Você pode editar o cadastro existente ou tentar excluí-lo. A exclusão será bloqueada se houver agendamentos futuros."
              : "Este é um cliente autenticado e não pode ser alterado por este fluxo."}
          </p>
        </div>

        <DialogFooter className="flex-col items-center justify-center gap-2 sm:justify-between">
          {isManualCustomer ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit cursor-pointer text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Excluir cliente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A operação não pode ser desfeita. Clientes com agendamentos
                    futuros não serão excluídos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {deleting ? "Excluindo..." : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          )}

          {isManualCustomer && (
            <Button type="button" onClick={() => onEdit(customer)}>
              Editar existente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
