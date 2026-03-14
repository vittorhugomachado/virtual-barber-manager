import { Button } from "@/components/ui/button";
import { useBarbers } from "@/hooks/use-barbers";
import { useServices } from "@/hooks/use-service";
import type { SelectedCustomer } from "@/types/create-appointment";
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
  serviceId,
  barberId,
  date,
  time,
  onConfirm,
  onClose,
  submitting,
  error,
}: {
  customer: SelectedCustomer;
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const { services } = useServices();
  const { barbers } = useBarbers();

  const service = services.find(s => s.id === serviceId);
  const barber = barbers.find(b => b.id === barberId);

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const rows = [
    {
      icon: <User className="h-3.5 w-3.5" />,
      label: "Cliente",
      value: customer.name,
    },
    {
      icon: <Phone className="h-3.5 w-3.5" />,
      label: "Telefone",
      value: maskPhone(customer.phone),
    },
    {
      icon: <Sparkles className="h-3.5 w-3.5" />,
      label: "Serviço",
      value: service?.name ?? "—",
    },
    {
      icon: <Scissors className="h-3.5 w-3.5" />,
      label: "Profissional",
      value: barber?.name ?? "—",
    },
    {
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      label: "Data",
      value: dateLabel,
    },
    { icon: <Clock className="h-3.5 w-3.5" />, label: "Horário", value: time },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="text-muted-foreground shrink-0">{row.icon}</span>
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              {row.label}
            </span>
            <span className="text-sm font-medium capitalize">{row.value}</span>
          </div>
        ))}
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
          className="cursor-pointer flex-1"
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
