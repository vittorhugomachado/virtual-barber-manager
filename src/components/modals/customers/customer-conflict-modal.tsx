import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { maskPhone } from "@/utils/masked-input-phone";
import type { Customer } from "@/types/customer";

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
  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Cliente já cadastrado</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-muted-foreground">
            Já existe um cliente com esse número de celular:
          </p>

          <div className="flex flex-col gap-1 p-4 rounded-lg border">
            <span className="font-semibold">{customer.name}</span>
            <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {maskPhone(customer.phone)}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Deseja editar o cliente existente ou excluí-lo?
          </p>
        </div>

        <DialogFooter className="flex-row flex-wrap items-center justify-center gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive cursor-pointer"
            onClick={() => onDelete(customer)}
          >
            Excluir cliente
          </Button>

          <div className="flex flex-2 gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
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
