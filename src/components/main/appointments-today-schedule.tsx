import { useMemo, useState } from "react";
import { CalendarDays, Clock3, Scissors, UserRound } from "lucide-react";
import type { AppointmentWithRelations } from "@/types/create-appointment";
import type { OpeningHours } from "@/types/opening-hours";
import type { Barber } from "@/types/barber";
import { AppointmentDetailsModal } from "@/components/modals/appointments/appointment-details-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const HOUR_HEIGHT = 96;
const DEFAULT_START_MINUTES = 8 * 60;
const DEFAULT_END_MINUTES = 20 * 60;
const TIME_LABEL_WIDTH = 72;
const APPOINTMENT_COLUMN_WIDTH = 136;
const PROFESSIONAL_COLUMN_WIDTH = 160;
const UNASSIGNED_BARBER_KEY = "__unassigned__";

type PositionedAppointment = {
  appointment: AppointmentWithRelations;
  startMinutes: number;
  endMinutes: number;
  column: number;
  columnCount: number;
};

type ProfessionalColumn = {
  key: string;
  name: string;
  avatarUrl: string | null;
  width: number;
  appointments: PositionedAppointment[];
};

const STATUS_CARD_COLORS: Record<AppointmentWithRelations["status"], string> = {
  scheduled:
    "border-blue-500 bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-50",
  confirmed:
    "border-blue-500 bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-50",
  in_progress:
    "border-blue-500 bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-50",
  completed:
    "border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
  cancelled_by_customer:
    "border-red-500 bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-50",
  cancelled_by_barbershop:
    "border-red-500 bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-50",
  no_show:
    "border-zinc-500 bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50",
};

function parseTimeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function getTimeParts(isoString: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoString));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value ?? 0);
  return { hours: value("hour"), minutes: value("minute") };
}

function getMinutesInTimezone(isoString: string, timezone: string) {
  const { hours, minutes } = getTimeParts(isoString, timezone);
  return hours * 60 + minutes;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

function formatAppointmentTime(isoString: string, timezone: string) {
  const { hours, minutes } = getTimeParts(isoString, timezone);
  return formatMinutes(hours * 60 + minutes);
}

function dateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function layoutAppointments(
  appointments: AppointmentWithRelations[],
  timezone: string,
) {
  const sorted = appointments
    .map(appointment => ({
      appointment,
      startMinutes: getMinutesInTimezone(appointment.starts_at, timezone),
      endMinutes: getMinutesInTimezone(appointment.ends_at, timezone),
    }))
    .map(item => ({
      ...item,
      endMinutes:
        item.endMinutes <= item.startMinutes
          ? item.endMinutes + 24 * 60
          : item.endMinutes,
    }))
    .sort(
      (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
    );

  const positioned: PositionedAppointment[] = [];
  let cluster: typeof sorted = [];
  let clusterEnd = -1;

  function finishCluster() {
    if (cluster.length === 0) return;

    const columnEnds: number[] = [];
    const items = cluster.map(item => {
      let column = columnEnds.findIndex(end => end <= item.startMinutes);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = item.endMinutes;
      return { ...item, column };
    });
    const columnCount = Math.max(columnEnds.length, 1);
    positioned.push(...items.map(item => ({ ...item, columnCount })));
    cluster = [];
    clusterEnd = -1;
  }

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) {
      finishCluster();
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  finishCluster();

  return positioned;
}

function buildProfessionalColumns(
  barbers: Barber[],
  appointments: AppointmentWithRelations[],
  timezone: string,
): ProfessionalColumn[] {
  const professionals = new Map<
    string,
    { key: string; name: string; avatarUrl: string | null }
  >();

  [...barbers]
    .filter(barber => barber.is_active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .forEach(barber => {
      professionals.set(barber.id, {
        key: barber.id,
        name: barber.name,
        avatarUrl: barber.avatar_url,
      });
    });

  for (const appointment of appointments) {
    const key = appointment.barber_id ?? UNASSIGNED_BARBER_KEY;
    if (professionals.has(key)) continue;
    professionals.set(key, {
      key,
      name: appointment.barber_name ?? "Sem profissional",
      avatarUrl: appointment.barber?.avatar_url ?? null,
    });
  }

  if (professionals.size === 0) {
    professionals.set(UNASSIGNED_BARBER_KEY, {
      key: UNASSIGNED_BARBER_KEY,
      name: "Sem profissional",
      avatarUrl: null,
    });
  }

  return [...professionals.values()].map(professional => {
    const professionalAppointments = layoutAppointments(
      appointments.filter(
        appointment =>
          (appointment.barber_id ?? UNASSIGNED_BARBER_KEY) === professional.key,
      ),
      timezone,
    );
    const simultaneousColumns = Math.max(
      1,
      ...professionalAppointments.map(item => item.columnCount),
    );

    return {
      ...professional,
      width: Math.max(
        PROFESSIONAL_COLUMN_WIDTH,
        simultaneousColumns * APPOINTMENT_COLUMN_WIDTH,
      ),
      appointments: professionalAppointments,
    };
  });
}

function getScheduleBounds(
  date: Date,
  openingHours: OpeningHours[],
  appointments: PositionedAppointment[],
) {
  const periods = openingHours.filter(
    period => period.day_of_week === date.getDay() && period.is_open,
  );
  const appointmentStarts = appointments.map(item => item.startMinutes);
  const appointmentEnds = appointments.map(item => item.endMinutes);
  const configuredStarts = periods.map(period =>
    parseTimeToMinutes(period.opens_at),
  );
  const configuredEnds = periods.map(period =>
    parseTimeToMinutes(period.closes_at),
  );

  const earliest = Math.min(
    configuredStarts.length
      ? Math.min(...configuredStarts)
      : DEFAULT_START_MINUTES,
    appointmentStarts.length
      ? Math.min(...appointmentStarts)
      : DEFAULT_START_MINUTES,
  );
  const latest = Math.max(
    configuredEnds.length ? Math.max(...configuredEnds) : DEFAULT_END_MINUTES,
    appointmentEnds.length ? Math.max(...appointmentEnds) : DEFAULT_END_MINUTES,
  );

  return {
    startMinutes: Math.floor(earliest / 60) * 60,
    endMinutes: Math.ceil(latest / 60) * 60,
    periods,
  };
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span className={`size-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

export function AppointmentsTodaySchedule({
  date,
  appointments,
  barbers,
  openingHours,
  timezone,
  renderStatus,
}: {
  date: Date;
  appointments: AppointmentWithRelations[];
  barbers: Barber[];
  openingHours: OpeningHours[];
  timezone: string;
  renderStatus: (appointment: AppointmentWithRelations) => React.ReactNode;
}) {
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithRelations | null>(null);
  const professionalColumns = useMemo(
    () => buildProfessionalColumns(barbers, appointments, timezone),
    [appointments, barbers, timezone],
  );
  const positionedAppointments = useMemo(
    () => professionalColumns.flatMap(column => column.appointments),
    [professionalColumns],
  );
  const { startMinutes, endMinutes, periods } = useMemo(
    () => getScheduleBounds(date, openingHours, positionedAppointments),
    [date, openingHours, positionedAppointments],
  );
  const hours = useMemo(
    () =>
      Array.from(
        { length: (endMinutes - startMinutes) / 60 + 1 },
        (_, index) => startMinutes + index * 60,
      ),
    [endMinutes, startMinutes],
  );
  const timelineHeight = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
  const timelineMinWidth =
    TIME_LABEL_WIDTH +
    professionalColumns.reduce((total, column) => total + column.width, 0);
  const currentMinutes = getMinutesInTimezone(
    new Date().toISOString(),
    timezone,
  );
  const showCurrentTime =
    localDateKey(date) === dateKey(new Date(), timezone) &&
    currentMinutes >= startMinutes &&
    currentMinutes <= endMinutes;
  const openingLabel =
    periods.length > 0
      ? periods
          .map(
            period =>
              `${period.opens_at.slice(0, 5)}–${period.closes_at.slice(0, 5)}`,
          )
          .join(" · ")
      : "Horário não configurado";

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <h2 className="font-semibold capitalize">
                {date.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              {openingLabel} · {timezone}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            <LegendDot className="bg-blue-500" label="Agendado" />
            <LegendDot className="bg-emerald-500" label="Concluído" />
            <LegendDot className="bg-red-500" label="Cancelado" />
            <LegendDot className="bg-zinc-500" label="Não compareceu" />
          </div>
        </div>
      </header>

      <div className="max-h-[calc(100vh-13rem)] min-h-120 overflow-auto py-4">
        <div
          className="w-full"
          style={{
            minWidth: `${timelineMinWidth}px`,
          }}
        >
          <div className="sticky top-0 z-50 flex h-16 border-b bg-card shadow-sm">
            <div
              className="sticky left-0 z-[60] flex shrink-0 items-center justify-center border-r bg-card px-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ width: `${TIME_LABEL_WIDTH}px` }}
            >
              Horário
            </div>
            <div className="flex min-w-0 flex-1">
              {professionalColumns.map(column => (
                <div
                  key={column.key}
                  className="flex min-w-0 flex-1 items-center gap-2 border-r px-3"
                  style={{ minWidth: `${column.width}px` }}
                >
                  <Avatar className="size-8 shrink-0 border">
                    <AvatarImage src={column.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs font-semibold uppercase">
                      {column.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-semibold">
                    {column.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative" style={{ height: `${timelineHeight}px` }}>
            <div
              className="sticky left-0 z-30 h-full border-r bg-card"
              style={{ width: `${TIME_LABEL_WIDTH}px` }}
            />

            <div
              className="absolute inset-y-0 right-0 flex"
              style={{ left: `${TIME_LABEL_WIDTH}px` }}
            >
              {professionalColumns.map((column, index) => (
                <div
                  key={column.key}
                  className={`relative min-w-0 flex-1 border-r ${index % 2 === 0 ? "bg-muted/10" : "bg-transparent"}`}
                  style={{ minWidth: `${column.width}px` }}
                >
                  {column.appointments.map(item => {
                    const top =
                      ((item.startMinutes - startMinutes) / 60) * HOUR_HEIGHT;
                    const durationHeight =
                      ((item.endMinutes - item.startMinutes) / 60) *
                      HOUR_HEIGHT;
                    const width = 100 / item.columnCount;
                    const appointment = item.appointment;

                    return (
                      <article
                        key={appointment.id}
                        title={`${appointment.customer_name ?? "Cliente"} · ${appointment.service_name ?? "Serviço"} · ${appointment.barber_name ?? "Barbeiro"}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAppointment(appointment)}
                        onKeyDown={event => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedAppointment(appointment);
                          }
                        }}
                        className={`absolute z-20 cursor-pointer rounded-lg border-l-4 px-2 py-1.5 shadow-sm transition-shadow hover:z-40 hover:shadow-md focus-visible:z-40 focus-visible:ring-2 focus-visible:ring-ring ${STATUS_CARD_COLORS[appointment.status]}`}
                        style={{
                          top: `${top + 2}px`,
                          height: `${Math.max(durationHeight - 4, 44)}px`,
                          left: `calc(${item.column * width}% + 3px)`,
                          width: `calc(${width}% - 6px)`,
                        }}
                      >
                        <div className="flex h-full min-w-0 items-start justify-between gap-1.5 overflow-visible">
                          <div className="min-w-0 overflow-hidden text-[11px] leading-tight sm:text-xs">
                            <div className="flex min-w-0 items-center gap-1 font-semibold">
                              <UserRound className="size-3 shrink-0" />
                              <span className="truncate">
                                {appointment.customer_name ??
                                  "Cliente não informado"}
                              </span>
                              <span className="shrink-0 font-normal opacity-70">
                                {formatAppointmentTime(
                                  appointment.starts_at,
                                  timezone,
                                )}
                              </span>
                            </div>
                            <div className="mt-1 flex min-w-0 items-center gap-1 opacity-85">
                              <Scissors className="size-3 shrink-0" />
                              <span className="truncate">
                                {appointment.service_name ?? "Serviço"}
                              </span>
                              <span className="shrink-0">·</span>
                              <span className="truncate">
                                {appointment.barber_name ?? "Barbeiro"}
                              </span>
                            </div>
                          </div>
                          <div className="relative z-20 shrink-0">
                            {renderStatus(appointment)}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ))}
            </div>

            {hours.map((minutes, index) => (
              <div
                key={minutes}
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                style={{ top: `${index * HOUR_HEIGHT}px`, zIndex: 100 }}
              >
                <span
                  className="sticky left-0 z-40 flex h-7 shrink-0 -translate-y-1/2 items-center justify-end bg-card pr-3 text-right text-[11px] font-medium tabular-nums text-muted-foreground sm:text-xs"
                  style={{ width: `${TIME_LABEL_WIDTH}px` }}
                >
                  {formatMinutes(minutes)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ))}

            {appointments.length === 0 && (
              <div
                className="absolute top-8 z-20 flex items-center justify-center gap-2 rounded-xl border border-dashed bg-card/90 px-4 py-8 text-sm text-muted-foreground"
                style={{
                  left: `${TIME_LABEL_WIDTH + 16}px`,
                  right: "16px",
                }}
              >
                <CalendarDays className="size-4 opacity-50" />
                Nenhum agendamento para hoje.
              </div>
            )}

            {showCurrentTime && (
              <div
                className="pointer-events-none absolute right-0 z-30 flex items-center"
                style={{
                  left: `${TIME_LABEL_WIDTH}px`,
                  top: `${((currentMinutes - startMinutes) / 60) * HOUR_HEIGHT}px`,
                }}
              >
                <span className="-ml-1.5 size-3 rounded-full bg-red-500 shadow-sm" />
                <span className="h-0.5 flex-1 bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      <AppointmentDetailsModal
        appointment={selectedAppointment}
        timezone={timezone}
        open={selectedAppointment !== null}
        onOpenChange={open => {
          if (!open) setSelectedAppointment(null);
        }}
      />
    </section>
  );
}
