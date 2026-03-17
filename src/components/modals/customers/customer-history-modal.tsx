import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Clock, Phone, Scissors } from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import type { Customer } from "@/types/customer";
import type { AppointmentWithRelations } from "@/types/create-appointment";

interface CustomerHistoryModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export function CustomerHistoryModal({
  open,
  customer,
  onClose,
}: CustomerHistoryModalProps) {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;

    async function fetchHistory() {
      setLoading(true);
      supabase
        .from("appointments")
        .select(
          "*, customer:customers(id, name, phone), barber:barbers(id, name), service:services(id, name, duration_min, price)",
        )
        .eq("customer_id", customer?.id)
        .order("starts_at", { ascending: false })
        .then(({ data }) => {
          setAppointments((data as AppointmentWithRelations[]) ?? []);
          setLoading(false);
        });
    }

    fetchHistory();
  }, [open, customer]);

  if (!customer) return null;

  const lastAppointment = appointments[0];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de {customer.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            {customer.phone}
          </div>

          {/* Resumo */}
          <div className="flex items-center justify-center gap-6 py-4 border rounded-lg">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold">{appointments.length}</span>
              <span className="text-xs text-muted-foreground">
                agendamentos
              </span>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium">
                {lastAppointment
                  ? new Date(lastAppointment.starts_at).toLocaleDateString(
                      "pt-BR",
                    )
                  : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                último agendamento
              </span>
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
              <CalendarDays className="h-8 w-8 opacity-30" />
              <span className="text-sm opacity-50 text-center">
                Nenhum agendamento encontrado.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {appointments.map(apt => (
                <div
                  key={apt.id}
                  className="flex flex-col gap-1 p-3 rounded-lg border bg-muted/20 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{formatDateTime(apt.starts_at)}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
                      {apt.status === "scheduled" && "Agendado"}
                      {apt.status === "completed" && "Concluído"}
                      {apt.status === "cancelled_by_customer" && "Cancelado"}
                      {apt.status === "cancelled_by_barbershop" && "Cancelado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Scissors className="h-3.5 w-3.5 shrink-0" />
                    <span>{apt.service?.name ?? "Serviço removido"}</span>
                    {apt.barber?.name && (
                      <span className="text-muted-foreground/60">
                        · {apt.barber.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
