import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Phone } from "lucide-react";
import type { Customer } from "@/types/customer";

interface CustomerHistoryModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
}

export function CustomerHistoryModal({
  open,
  customer,
  onClose,
}: CustomerHistoryModalProps) {
  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Histórico de {customer.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            {customer.phone}
          </div>

          <div className="flex items-center justify-center gap-6 py-4 border rounded-lg">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold">
                {customer.total_appointments ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">
                agendamentos
              </span>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium">
                {customer.last_appointment
                  ? new Date(customer.last_appointment).toLocaleDateString(
                      "pt-BR",
                    )
                  : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                último agendamento
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
            <CalendarDays className="h-8 w-8 opacity-30" />
            <span className="text-sm opacity-50 text-center">
              O histórico completo estará disponível quando o módulo de
              agendamentos for ativado.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
