import { memo, useCallback, useMemo, useState } from "react";
import { useAppointments } from "@/hooks/use-appointments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Scissors,
  User,
} from "lucide-react";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_LABELS,
} from "@/types/create-appointment";
import type { AppointmentWithRelations } from "@/types/create-appointment";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateAppointmentModal } from "../modals/appointments/create-appointmend-modal/create-appointment-modal";
import { UpdateAppointmentModal } from "../modals/appointments/update-appointment-modal";
import { DeleteAppointmentModal } from "../modals/appointments/delete-appointment-appointment";

type FilterType = "today" | "week" | "month" | "year" | "custom";

function RemovedBadge({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-orange-500 cursor-help">
            {label}
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-55 text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getDaysForFilter(
  filter: FilterType,
  customRange?: { from?: Date; to?: Date },
): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filter === "today") {
    return [new Date(today)];
  }

  if (filter === "week") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  if (filter === "month") {
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d;
    });
  }

  if (filter === "year") {
    const year = today.getFullYear();
    const days: Date[] = [];
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        days.push(new Date(year, m, d));
      }
    }
    return days;
  }

  if (filter === "custom" && customRange?.from) {
    const days: Date[] = [];
    const start = new Date(customRange.from);
    start.setHours(0, 0, 0, 0);
    const end = customRange.to ? new Date(customRange.to) : new Date(start);
    end.setHours(0, 0, 0, 0);
    const current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  return [];
}

const FILTER_LABELS: Record<FilterType, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  year: "Este ano",
  custom: "Data específica",
};

function getRangeForFilter(
  filter: FilterType,
  customRange?: { from?: Date; to?: Date },
): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filter === "today") {
    const end = new Date(today);
    end.setHours(23, 59, 59);
    return { start: today, end };
  }

  if (filter === "week") {
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59);
    return { start: today, end };
  }

  if (filter === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start, end };
  }

  if (filter === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { start, end };
  }

  if (filter === "custom" && customRange?.from) {
    const start = new Date(customRange.from);
    start.setHours(0, 0, 0, 0);
    const end = customRange.to ? new Date(customRange.to) : new Date(start);
    end.setHours(23, 59, 59);
    return { start, end };
  }

  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  return { start: today, end };
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return "Hoje";
  if (date.getTime() === tomorrow.getTime()) return "Amanhã";

  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function isSameDay(date: Date, isoString: string): boolean {
  const d = new Date(isoString);
  return (
    d.getUTCFullYear() === date.getFullYear() &&
    d.getUTCMonth() === date.getMonth() &&
    d.getUTCDate() === date.getDate()
  );
}

// ─── DaySection recebe callbacks para abrir os modais ────────────────────────
const DaySection = memo(function DaySection({
  date,
  appointments,
  onEdit,
  onCancel,
}: {
  date: Date;
  appointments: AppointmentWithRelations[];
  onEdit: (apt: AppointmentWithRelations) => void;
  onCancel: (apt: AppointmentWithRelations) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = formatDayLabel(date);
  const isToday = label === "Hoje";

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span
            className={`text-sm font-semibold text-start capitalize ${isToday ? "text-primary" : ""}`}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {appointments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {appointments.length}{" "}
              <span className="hidden">
                agendamento
                {appointments.length !== 1 ? "s" : ""}
              </span>
            </Badge>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t">
          {appointments.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <CalendarDays className="h-4 w-4 opacity-40" />
              <span className="text-sm opacity-50">
                Nenhum agendamento para este dia.
              </span>
            </div>
          ) : (
            <div className="divide-y">
              {appointments.map(apt => (
                <div
                  key={apt.id}
                  className="flex flex-col sm:flex-row items-center gap-2 md:gap-4 px-4 py-3"
                >
                  {(() => {
                    const cancelled =
                      apt.status === "cancelled_by_customer" ||
                      apt.status === "cancelled_by_barbershop";
                    const dim = cancelled ? "opacity-30" : "";
                    return (
                      <>
                        <div className={`w-full flex gap-3 ${dim}`}>
                          <div className="flex items-center gap-1.5 text-sm shrink-0 w-24">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">
                              {formatTime(apt.starts_at)}
                            </span>
                            <span className="text-muted-foreground">–</span>
                            <span className="text-muted-foreground">
                              {formatTime(apt.ends_at)}
                            </span>
                          </div>

                          <div className="flex items-center justify-center gap-1.5 text-sm flex-1 min-w-0">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate font-medium">
                              {apt.customer?.name ?? (
                                <RemovedBadge
                                  label="Cliente removido"
                                  tooltip="Este cliente foi excluído do sistema. O agendamento ainda existe no histórico."
                                />
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
                            <Scissors className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate text-muted-foreground">
                              {apt.barber?.name ?? (
                                <RemovedBadge
                                  label="Barbeiro removido"
                                  tooltip="Este barbeiro foi excluído do sistema. O agendamento ainda existe no histórico."
                                />
                              )}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`hidden lg:flex items-center gap-1.5 text-sm flex-1 min-w-0 ${dim}`}
                        >
                          <span className="truncate text-muted-foreground">
                            {apt.service?.name ?? (
                              <RemovedBadge
                                label="Serviço removido"
                                tooltip="Este serviço foi excluído do sistema. O agendamento ainda existe no histórico."
                              />
                            )}
                          </span>
                        </div>
                      </>
                    );
                  })()}

                  <div className="shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${APPOINTMENT_STATUS_COLORS[apt.status]}`}
                    >
                      {APPOINTMENT_STATUS_LABELS[apt.status]}
                    </span>
                  </div>
                  <div
                    className={`${
                      apt.status == "cancelled_by_customer" ||
                      (apt.status == "cancelled_by_barbershop" &&
                        "opacity-0 hidden sm:block sm:ml-2")
                    } flex items-center gap-2 shrink-0`}
                  >
                    <Button
                      disabled={
                        apt.status == "cancelled_by_customer" ||
                        apt.status == "cancelled_by_barbershop"
                      }
                      size="sm"
                      variant="outline"
                      className="cursor-pointer text-xs h-7"
                      onClick={() => onEdit(apt)}
                    >
                      Editar
                    </Button>
                    <Button
                      disabled={
                        apt.status == "cancelled_by_customer" ||
                        apt.status == "cancelled_by_barbershop"
                      }
                      size="sm"
                      variant="outline"
                      className="cursor-pointer text-xs h-7 text-destructive hover:text-destructive"
                      onClick={() => onCancel(apt)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─── AppointmentsMain ─────────────────────────────────────────────────────────
export function AppointmentsMain() {
  const [filter, setFilter] = useState<FilterType>("week");

  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>(
    {},
  );

  const { start, end } = useMemo(
    () => getRangeForFilter(filter, customRange),
    [filter, customRange],
  );
  const { appointments, loading, refetch } = useAppointments(start, end);

  const days = useMemo(
    () =>
      getDaysForFilter(filter, customRange).filter(day =>
        appointments.some(apt => isSameDay(day, apt.starts_at)),
      ),
    [filter, customRange, appointments],
  );

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>();
    for (const day of days) {
      map.set(
        day.toISOString(),
        appointments.filter(apt => isSameDay(day, apt.starts_at)),
      );
    }
    return map;
  }, [days, appointments]);

  // ── Estados dos modais ──────────────────────────────────────────────────────
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [editAppointment, setEditAppointment] =
    useState<AppointmentWithRelations | null>(null);
  const [cancelAppointment, setCancelAppointment] =
    useState<AppointmentWithRelations | null>(null);

  const handleEdit = useCallback((apt: AppointmentWithRelations) => {
    setEditAppointment(apt);
  }, []);

  const handleCancel = useCallback((apt: AppointmentWithRelations) => {
    setCancelAppointment(apt);
  }, []);

  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
      <div className="lg:flex lg:flex-row-reverse">
        {/* Header */}
        <div className="w-fit flex flex-col sm:flex-row gap-4 items-center justify-between mx-auto lg:mr-0 mb-6">
          <Button
            className="cursor-pointer"
            onClick={() => setNewModalOpen(true)}
          >
            <Plus className="h-4 w-4 " />
            <span className="">Novo agendamento</span>
          </Button>
        </div>

        {/* Filtros */}
        <div>
          <div className="w-fit mx-auto lg:ml-0 flex flex-col items-center lg:items-start gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(["today", "week", "month", "year"] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
                    filter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}

              <button
                onClick={() => setFilter("custom")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                  filter === "custom"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Data específica
              </button>
            </div>
          </div>
          {filter === "custom" && (
            <div className="flex flex-wrap items-center lg:justify-start justify-center gap-3 px-1 mt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  De
                </label>
                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={
                      customRange.from
                        ? customRange.from.toISOString().split("T")[0]
                        : ""
                    }
                    onChange={e => {
                      const d = e.target.value
                        ? new Date(e.target.value + "T00:00:00")
                        : undefined;
                      setCustomRange(r => ({ ...r, from: d }));
                    }}
                    style={{ colorScheme: "light" }}
                    className="h-8 rounded-md border border-border bg-background pl-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Até
                </label>
                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={
                      customRange.to
                        ? customRange.to.toISOString().split("T")[0]
                        : ""
                    }
                    min={
                      customRange.from
                        ? customRange.from.toISOString().split("T")[0]
                        : undefined
                    }
                    onChange={e => {
                      const d = e.target.value
                        ? new Date(e.target.value + "T00:00:00")
                        : undefined;
                      setCustomRange(r => ({ ...r, to: d }));
                    }}
                    style={{ colorScheme: "light" }}
                    className="h-8 rounded-md border border-border bg-background pl-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-text [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dias */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-20" />
          <span className="text-sm opacity-50">
            Nenhum agendamento encontrado neste período.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map(day => (
            <DaySection
              key={day.toISOString()}
              date={day}
              appointments={appointmentsByDay.get(day.toISOString()) ?? []}
              onEdit={handleEdit}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      <CreateAppointmentModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSuccess={refetch}
      />

      <UpdateAppointmentModal
        open={!!editAppointment}
        appointment={editAppointment}
        onClose={() => setEditAppointment(null)}
        onSuccess={refetch} // ✅
      />

      <DeleteAppointmentModal
        open={!!cancelAppointment}
        appointment={cancelAppointment}
        onClose={() => setCancelAppointment(null)}
        onSuccess={refetch} // ✅
      />
    </main>
  );
}
