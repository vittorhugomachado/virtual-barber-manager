import { Button } from "@/components/ui/button";
import { useBarbers } from "@/hooks/use-barbers";
import { useServices } from "@/hooks/use-service";
import type { SelectedCustomer, ServiceSelection } from "@/types/create-appointment";
import { maskPhone } from "@/utils/masked-input-phone";
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Phone,
  Scissors,
  Sparkles,
  User,
} from "lucide-react";

export function ConfirmStep({
  customer,
  serviceSelections,
  date,
  onConfirm,
  onClose,
  submitting,
  error,
}: {
  customer: SelectedCustomer;
  serviceSelections: ServiceSelection[];
  date: string;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const { services } = useServices();
  const { barbers } = useBarbers();

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const totalDuration = serviceSelections.reduce((acc, sel) => {
    const s = services.find(sv => sv.id === sel.serviceId);
    return acc + (s?.duration_min ?? 0);
  }, 0);

  const totalPrice = serviceSelections.reduce((acc, sel) => {
    const s = services.find(sv => sv.id === sel.serviceId);
    return acc + (Number(s?.price) ?? 0);
  }, 0);

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      {/* Customer + date */}
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-muted-foreground shrink-0">
            <User className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-muted-foreground w-16 shrink-0">
            Cliente
          </span>
          <span className="text-sm font-medium">{customer.name}</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-muted-foreground shrink-0">
            <Phone className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-muted-foreground w-16 shrink-0">
            Telefone
          </span>
          <span className="text-sm font-medium">
            {maskPhone(customer.phone)}
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-muted-foreground shrink-0">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-muted-foreground w-16 shrink-0">
            Data
          </span>
          <span className="text-sm font-medium capitalize">{dateLabel}</span>
        </div>
        {(totalDuration > 0 || totalPrice > 0) && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-muted-foreground shrink-0">
              <Clock className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              Total
            </span>
            <span className="text-sm font-medium">
              {totalDuration > 0 ? `${totalDuration} min` : ""}
              {totalDuration > 0 && totalPrice > 0 ? " · " : ""}
              {totalPrice > 0
                ? `R$ ${totalPrice.toFixed(2).replace(".", ",")}`
                : ""}
            </span>
          </div>
        )}
      </div>

      {/* Per-service blocks */}
      <div className="flex flex-col gap-3">
        {serviceSelections.map((sel, i) => {
          const service = services.find(s => s.id === sel.serviceId);
          const barber = barbers.find(b => b.id === sel.barberId);

          return (
            <div
              key={sel.serviceId}
              className="rounded-xl border border-border overflow-hidden divide-y divide-border"
            >
              <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Serviço {i + 1}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-muted-foreground shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs text-muted-foreground w-20 shrink-0">
                  Serviço
                </span>
                <span className="text-sm font-medium">
                  {service?.name ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-muted-foreground shrink-0">
                  <Scissors className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs text-muted-foreground w-20 shrink-0">
                  Profissional
                </span>
                <span className="text-sm font-medium">
                  {barber?.name ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-muted-foreground shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs text-muted-foreground w-20 shrink-0">
                  Horário
                </span>
                <span className="text-sm font-medium">{sel.time}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={submitting}
          className="cursor-pointer flex-1 rounded-full"
        >
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={submitting}
          className="cursor-pointer flex-1"
        >
          {submitting ? "Salvando…" : "Confirmar agendamento"}
        </Button>
      </div>
    </div>
  );
}
