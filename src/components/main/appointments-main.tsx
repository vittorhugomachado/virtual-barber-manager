import { useEffect, useRef, useState } from "react";
import { useAppointments } from "@/hooks/use-appointments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Scissors,
  User,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_LABELS,
} from "@/types/appointment";
import type { AppointmentWithRelations } from "@/types/appointment";
import { Skeleton } from "@/components/ui/skeleton";

type FilterType = "week" | "month" | "year" | "custom";

function getDaysForFilter(
  filter: FilterType,
  customRange?: { from?: Date; to?: Date },
): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(date: Date, isoString: string): boolean {
  const d = new Date(isoString);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

function DaySection({
  date,
  appointments,
}: {
  date: Date;
  appointments: AppointmentWithRelations[];
}) {
  const [open, setOpen] = useState(false);
  const label = formatDayLabel(date);
  const isToday = label === "Hoje";

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header do dia */}
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
            className={`text-sm font-semibold capitalize ${isToday ? "text-primary" : ""}`}
          >
            {label}
          </span>
          <span className="text-xs text-muted-foreground">
            {date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {appointments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {appointments.length} agendamento
              {appointments.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </button>

      {/* Tabela de agendamentos */}
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
                  className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3"
                >
                  {/* Horário */}
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

                  {/* Cliente */}
                  <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate font-medium">
                      {apt.customer.name}
                    </span>
                  </div>

                  {/* Barbeiro */}
                  <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
                    <Scissors className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-muted-foreground">
                      {apt.barber.name}
                    </span>
                  </div>

                  {/* Serviço */}
                  <div className="hidden lg:flex items-center gap-1.5 text-sm flex-1 min-w-0">
                    <span className="truncate text-muted-foreground">
                      {apt.service.name}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${APPOINTMENT_STATUS_COLORS[apt.status]}`}
                    >
                      {APPOINTMENT_STATUS_LABELS[apt.status]}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer text-xs h-7"
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer text-xs h-7 text-destructive hover:text-destructive"
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
}

export function AppointmentsMain() {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterType>("week");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>(
    {},
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { start, end } = getRangeForFilter(filter, customRange);
  const { appointments, loading } = useAppointments(start, end);

  const days = getDaysForFilter(filter, customRange).filter(day =>
    appointments.some(apt => isSameDay(day, apt.starts_at)),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(e.target as Node)
      ) {
        setCalendarOpen(false);
      }
    }
    if (calendarOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 pb-12 mx-auto mt-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col w-fit">
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
        </div>
        <Button className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Novo agendamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {(["week", "month", "year"] as FilterType[]).map(f => (
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

        <div ref={calendarRef} className="relative">
          <div
            role="button"
            onClick={() => {
              setFilter("custom");
              setCalendarOpen(o => !o);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
              filter === "custom"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {filter === "custom" && customRange.from
              ? customRange.to
                ? `${customRange.from.toLocaleDateString("pt-BR")} - ${customRange.to.toLocaleDateString("pt-BR")}`
                : customRange.from.toLocaleDateString("pt-BR")
              : "Data específica"}
          </div>

          {calendarOpen && (
            <div className="absolute top-10 left-0 z-50 rounded-md border bg-popover shadow-md">
              <Calendar
                mode="range"
                selected={{ from: customRange.from, to: customRange.to }}
                onSelect={range => {
                  setCustomRange({ from: range?.from, to: range?.to });
                  setFilter("custom");
                  // só fecha se from e to forem DIAS DIFERENTES
                  if (
                    range?.from &&
                    range?.to &&
                    range.from.getTime() !== range.to.getTime()
                  ) {
                    setCalendarOpen(false);
                  }
                }}
              />
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
              appointments={appointments.filter(apt =>
                isSameDay(day, apt.starts_at),
              )}
            />
          ))}
        </div>
      )}
    </main>
  );
}
