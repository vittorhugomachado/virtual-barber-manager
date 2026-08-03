import {
  CalendarDays,
  Clock3,
  ContactRound,
  DollarSign,
  Phone,
  Scissors,
  StickyNote,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentWithRelations,
} from "@/types/create-appointment";

function formatDate(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleDateString("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailItem({
  icon,
  label,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-muted/25 p-3 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium capitalize">{children}</div>
    </div>
  );
}

export function AppointmentDetailsModal({
  appointment,
  timezone,
  open,
  onOpenChange,
}: {
  appointment: AppointmentWithRelations | null;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!appointment) return null;

  const duration =
    appointment.service_duration_min ??
    Math.max(
      0,
      Math.round(
        (new Date(appointment.ends_at).getTime() -
          new Date(appointment.starts_at).getTime()) /
          60_000,
      ),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Detalhes do agendamento</DialogTitle>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${APPOINTMENT_STATUS_COLORS[appointment.status]}`}
            >
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </span>
          </div>
          <DialogDescription>
            Informações registradas para este atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailItem
            icon={<CalendarDays className="size-3.5" />}
            label="Data"
            className="sm:col-span-2"
          >
            {formatDate(appointment.starts_at, timezone)}
          </DetailItem>

          <DetailItem icon={<Clock3 className="size-3.5" />} label="Horário">
            {formatTime(appointment.starts_at, timezone)}–
            {formatTime(appointment.ends_at, timezone)}
          </DetailItem>

          <DetailItem icon={<Clock3 className="size-3.5" />} label="Duração">
            {duration} minutos
          </DetailItem>

          <DetailItem icon={<UserRound className="size-3.5" />} label="Cliente">
            {appointment.customer_name ?? "Não informado"}
          </DetailItem>

          <DetailItem icon={<Phone className="size-3.5" />} label="Telefone">
            {appointment.customer?.phone ?? "Não informado"}
          </DetailItem>

          <DetailItem icon={<Scissors className="size-3.5" />} label="Serviço">
            {appointment.service_name ?? "Não informado"}
          </DetailItem>

          <DetailItem
            icon={<ContactRound className="size-3.5" />}
            label="Barbeiro"
          >
            {appointment.barber_name ?? "Não informado"}
          </DetailItem>

          <DetailItem icon={<DollarSign className="size-3.5" />} label="Valor">
            {appointment.service_price == null
              ? "Não informado"
              : appointment.service_price.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
          </DetailItem>

          <DetailItem
            icon={<StickyNote className="size-3.5" />}
            label="Observações"
            className="sm:col-span-2"
          >
            <span className="normal-case whitespace-pre-wrap">
              {appointment.notes?.trim() || "Nenhuma observação."}
            </span>
          </DetailItem>
        </div>
      </DialogContent>
    </Dialog>
  );
}
