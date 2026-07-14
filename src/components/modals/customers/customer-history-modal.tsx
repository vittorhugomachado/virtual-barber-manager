import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Scissors,
} from "lucide-react";
import { getCustomerHistory } from "@/lib/supabase/customers/get-customer-history";
import { useBarbershopStore } from "@/store/barbershop.store";
import { maskPhone } from "@/utils/mask-phone";
import type { Customer, CustomerHistoryItem } from "@/types/customer";

interface CustomerHistoryModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

function getStatusBadge(status: CustomerHistoryItem["status"]) {
  switch (status) {
    case "scheduled":
    case "confirmed":
      return {
        label: status === "confirmed" ? "Confirmado" : "Agendado",
        className: "border border-blue-500/20 bg-blue-500/10 text-blue-600",
      };
    case "in_progress":
      return {
        label: "Em atendimento",
        className: "border border-amber-500/20 bg-amber-500/10 text-amber-600",
      };
    case "completed":
      return {
        label: "Concluído",
        className:
          "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
      };
    case "cancelled_by_customer":
    case "cancelled_by_barbershop":
      return {
        label: "Cancelado",
        className: "border border-rose-500/20 bg-rose-500/10 text-rose-600",
      };
    case "no_show":
      return {
        label: "Não compareceu",
        className: "border border-border bg-muted text-muted-foreground",
      };
  }
}

export function CustomerHistoryModal({
  open,
  customer,
  onClose,
}: CustomerHistoryModalProps) {
  const barbershopId = useBarbershopStore(state => state.barbershop?.id);
  const [appointments, setAppointments] = useState<CustomerHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [lastAppointment, setLastAppointment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !customer || !barbershopId) return;

    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError(false);

      try {
        const result = await getCustomerHistory({
          barbershopId: barbershopId!,
          customerId: customer!.id,
          source: customer!.source,
          page,
        });
        if (!active) return;
        if (result.status !== "ok") {
          setError(true);
          return;
        }
        setAppointments(result.items);
        setTotal(result.total);
        setTotalPages(result.total_pages);
        setLastAppointment(result.last_appointment);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, [open, customer, barbershopId, page]);

  if (!customer) return null;

  function handleClose() {
    setPage(1);
    setAppointments([]);
    setTotal(0);
    setTotalPages(0);
    setLastAppointment(null);
    setError(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={nextOpen => !nextOpen && handleClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de {customer.name}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Histórico do cliente
        </DialogDescription>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            {customer.phone ? maskPhone(customer.phone) : "Sem telefone"}
          </div>

          <div className="flex items-center justify-center gap-6 rounded-lg border py-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold">{total}</span>
              <span className="text-xs text-muted-foreground">
                agendamentos
              </span>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium">
                {lastAppointment
                  ? new Date(lastAppointment).toLocaleDateString("pt-BR")
                  : "-"}
              </span>
              <span className="text-xs text-muted-foreground">
                último agendamento
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              Não foi possível carregar o histórico.
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
              <CalendarDays className="h-8 w-8 opacity-30" />
              <span className="text-center text-sm opacity-50">
                Nenhum agendamento encontrado.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {appointments.map(appointment => {
                const statusBadge = getStatusBadge(appointment.status);
                return (
                  <div
                    key={appointment.id}
                    className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatDateTime(appointment.starts_at)}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Scissors className="h-3.5 w-3.5 shrink-0" />
                      <span>{appointment.service_name}</span>
                      {appointment.barber_name && (
                        <span className="text-muted-foreground/60">
                          - {appointment.barber_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(current => current + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
