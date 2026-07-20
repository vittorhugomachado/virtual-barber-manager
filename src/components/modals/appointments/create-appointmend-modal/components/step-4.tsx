import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  appointmentCacheKey,
  loadAppointmentCache,
} from "@/lib/appointments-cache";
import { getAvailableAppointmentSlots } from "@/lib/supabase/appointments/appointments";
import { useBarbershopStore } from "@/store/barbershop.store";
import type {
  AppointmentBookingContext,
  ServiceSelection,
  TimeSlot,
} from "@/types/create-appointment";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Pencil,
  Trash2,
  User,
} from "lucide-react";

type SlotCache = Record<string, TimeSlot[]>;
type LoadingCache = Record<string, boolean>;

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKeyInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function groupSlotsByPeriod(slots: TimeSlot[]) {
  const manha: TimeSlot[] = [];
  const tarde: TimeSlot[] = [];
  const noite: TimeSlot[] = [];

  for (const slot of slots) {
    const minutes = timeToMinutes(slot.time);

    if (minutes < 13 * 60) {
      manha.push(slot);
    } else if (minutes < 18 * 60) {
      tarde.push(slot);
    } else {
      noite.push(slot);
    }
  }

  return { manha, tarde, noite };
}

function SlotGroup({
  title,
  slots,
  onSelect,
}: {
  title: string;
  slots: TimeSlot[];
  onSelect: (time: string) => void;
}) {
  if (slots.length === 0) return null;

  const hasAvailable = slots.some(slot => slot.available);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        {!hasAvailable && (
          <span className="text-xs text-muted-foreground/50">- lotado</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.map(slot => (
          <button
            key={slot.time}
            disabled={!slot.available}
            onClick={() => slot.available && onSelect(slot.time)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
              slot.available
                ? "border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                : "border-border/40 bg-muted/20 text-muted-foreground/35 line-through cursor-not-allowed"
            }`}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}

function BarberCard({
  barber,
  durationMin,
  slots,
  loading,
  expanded,
  onToggle,
  onSelectTime,
}: {
  barber: { id: string; name: string; avatar_url: string | null };
  durationMin: number | null;
  slots: TimeSlot[];
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelectTime: (time: string) => void;
}) {
  const { manha, tarde, noite } = groupSlotsByPeriod(slots);
  const dayOff = !loading && slots.length === 0;

  //CONSOLE PARA DEBUG
  // console.log("compoenente barberCard do step 4 ", {
  //   barber,
  //   durationMin,
  //   slots,
  // });

  return (
    <div
      className={`overflow-hidden rounded-xl border-2 transition-all ${
        expanded ? "border-primary/60" : "border-border"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            {barber.avatar_url ? (
              <img
                src={barber.avatar_url}
                alt={barber.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{barber.name}</p>
            {loading && (
              <p className="text-xs text-muted-foreground/60">Verificando...</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {durationMin && (
            <p className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Clock className="h-3 w-3" />
              {durationMin} min
            </p>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border px-4 pb-4 pt-2">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Verificando disponibilidade...
            </p>
          ) : dayOff ? (
            <div className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground">
              <AlertCircle className="h-5 w-5 opacity-40" />
              <p className="text-sm">Sem atendimento neste dia.</p>
            </div>
          ) : (
            <>
              <SlotGroup title="Manha" slots={manha} onSelect={onSelectTime} />
              <SlotGroup title="Tarde" slots={tarde} onSelect={onSelectTime} />
              <SlotGroup title="Noite" slots={noite} onSelect={onSelectTime} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceSection({
  index,
  service,
  barbers,
  eligibleBarberIds,
  selection,
  expandedBarber,
  getSlots,
  getSlotsLoading,
  onToggleBarber,
  onSelectTime,
  onClearSelection,
  onRemove,
  canRemove,
}: {
  index: number;
  service: {
    id: string;
    name: string;
    duration_min: number | null;
    price: number | null;
  };
  barbers: {
    id: string;
    name: string;
    avatar_url: string | null;
    is_active: boolean;
  }[];
  eligibleBarberIds: string[];
  selection: { barberId: string; time: string } | null;
  expandedBarber: string | null;
  getSlots: (barberId: string) => TimeSlot[];
  getSlotsLoading: (barberId: string) => boolean;
  onToggleBarber: (barberId: string) => void;
  onSelectTime: (barberId: string, time: string) => void;
  onClearSelection: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const visibleBarbers = barbers.filter(
    barber => barber.is_active && eligibleBarberIds.includes(barber.id),
  );
  const selectedBarber = selection
    ? barbers.find(barber => barber.id === selection.barberId)
    : null;

  //CONSOLE PARA DEBUG
  // console.log("compoenente serviceSelection step 4 ", {
  //   service,
  //   barbers,
  //   visibleBarbers,
  //   selectedBarber,
  // });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold">{service.name}</p>
            <p className="text-xs text-muted-foreground">
              {service.duration_min ? `${service.duration_min} min` : ""}
              {service.duration_min && service.price ? " · " : ""}
              {service.price
                ? `R$ ${Number(service.price).toFixed(2).replace(".", ",")}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {selection && (
            <button
              onClick={onClearSelection}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
              Alterar
            </button>
          )}
          <button
            onClick={onRemove}
            disabled={!canRemove}
            title="Remover servico"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {selection ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <Check className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">
            {selectedBarber?.name ?? "-"} as {selection.time}
          </span>
        </div>
      ) : visibleBarbers.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          Nenhum profissional disponivel para este servico.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleBarbers.map(barber => (
            <BarberCard
              key={barber.id}
              barber={barber}
              durationMin={service.duration_min}
              slots={getSlots(barber.id)}
              loading={getSlotsLoading(barber.id)}
              expanded={expandedBarber === barber.id}
              onToggle={() => onToggleBarber(barber.id)}
              onSelectTime={time => onSelectTime(barber.id, time)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Step4BarberTime({
  serviceIds,
  date,
  dateObj,
  onBack,
  onSelect,
  onDateChange,
  context,
}: {
  serviceIds: string[];
  date: string;
  dateObj: Date;
  onBack: () => void;
  onSelect: (selections: ServiceSelection[]) => void;
  onDateChange: (date: string, dateObj: Date) => void;
  context: AppointmentBookingContext;
}) {
  const { barbershop } = useBarbershopStore();
  const { opening_hours: openingHours, barbers, services } = context;

  const [currentDate, setCurrentDate] = useState(date);
  const [currentDateObj, setCurrentDateObj] = useState(dateObj);
  const [activeServiceIds, setActiveServiceIds] = useState(serviceIds);
  const eligibleBarberIds = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const relation of context.service_barbers) {
      (result[relation.service_id] ??= []).push(relation.barber_id);
    }
    return result;
  }, [context.service_barbers]);
  const [barbershopSlots, setBarbershopSlots] = useState<SlotCache>({});
  const [barbershopSlotsLoading, setBarbershopSlotsLoading] =
    useState<LoadingCache>({});
  const [expandedBarbers, setExpandedBarbers] = useState<
    Record<string, string | null>
  >({});
  const [selections, setSelections] = useState<
    Record<string, { barberId: string; time: string } | null>
  >({});
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const isShopOpen = useMemo(
    () =>
      openingHours.some(
        item => item.day_of_week === currentDateObj.getDay() && item.is_open,
      ),
    [currentDateObj, openingHours],
  );

  async function loadBarberSlots(
    serviceId: string,
    barberId: string,
    dateKey: string,
  ) {
    if (!barbershop?.id) return;

    const service = services.find(item => item.id === serviceId);
    if (!service) return;

    const cacheKey = `${serviceId}:${barberId}:${dateKey}`;
    setBarbershopSlotsLoading(prev => ({ ...prev, [cacheKey]: true }));
    setSlotsError(null);

    const sharedCacheKey = appointmentCacheKey(
      "slots",
      barbershop.id,
      serviceId,
      barberId,
      dateKey,
    );

    try {
      const slots = await loadAppointmentCache<TimeSlot[]>(
        sharedCacheKey,
        () =>
          getAvailableAppointmentSlots({
            barbershopId: barbershop.id,
            serviceId,
            barberId,
            localDate: dateKey,
          }),
        30_000,
      );
      setBarbershopSlots(prev => ({ ...prev, [cacheKey]: slots }));
    } catch {
      setBarbershopSlots(prev => ({ ...prev, [cacheKey]: [] }));
      setSlotsError(
        "Não foi possível verificar a disponibilidade. Tente novamente.",
      );
    } finally {
      setBarbershopSlotsLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  }

  function computeSlots(serviceId: string, barberId: string) {
    const cacheKey = `${serviceId}:${barberId}:${currentDate}`;
    const rawSlots = barbershopSlots[cacheKey] ?? [];
    const service = services.find(item => item.id === serviceId);
    const durationMin = service?.duration_min ?? 30;

    return rawSlots.map(slot => {
      if (!slot.available) return slot;

      const slotStart = timeToMinutes(slot.time);
      const slotEnd = slotStart + durationMin;

      const hasConflictWithSelection = Object.entries(selections).some(
        ([otherServiceId, selection]) => {
          if (!selection || otherServiceId === serviceId) return false;
          if (selection.barberId !== barberId) return false;

          const otherService = services.find(
            item => item.id === otherServiceId,
          );
          const otherDuration = otherService?.duration_min ?? 30;
          const otherStart = timeToMinutes(selection.time);
          const otherEnd = otherStart + otherDuration;

          return slotStart < otherEnd && slotEnd > otherStart;
        },
      );

      return { ...slot, available: !hasConflictWithSelection };
    });
  }

  function handleToggleBarber(serviceId: string, barberId: string) {
    const isClosing = expandedBarbers[serviceId] === barberId;

    setExpandedBarbers(previous => ({
      ...previous,
      [serviceId]: isClosing ? null : barberId,
    }));

    if (isClosing) return;

    const cacheKey = `${serviceId}:${barberId}:${currentDate}`;
    if (
      barbershopSlots[cacheKey] === undefined &&
      !barbershopSlotsLoading[cacheKey]
    ) {
      void loadBarberSlots(serviceId, barberId, currentDate);
    }
  }

  function handleSelectTime(serviceId: string, barberId: string, time: string) {
    setSelections(previous => ({
      ...previous,
      [serviceId]: { barberId, time },
    }));
    setExpandedBarbers(previous => ({
      ...previous,
      [serviceId]: null,
    }));
  }

  function handleClearSelection(serviceId: string) {
    setSelections(previous => ({
      ...previous,
      [serviceId]: null,
    }));
  }

  function removeService(serviceId: string) {
    setActiveServiceIds(previous =>
      previous.filter(item => item !== serviceId),
    );
    setSelections(previous => {
      const next = { ...previous };
      delete next[serviceId];
      return next;
    });
    setExpandedBarbers(previous => {
      const next = { ...previous };
      delete next[serviceId];
      return next;
    });
  }

  function changeDate(delta: number) {
    const nextDateObj = addDays(currentDateObj, delta);
    const nextDate = toDateKey(nextDateObj);

    setCurrentDate(nextDate);
    setCurrentDateObj(nextDateObj);
    setExpandedBarbers({});
    setSelections({});
    setBarbershopSlots({});
    setBarbershopSlotsLoading({});
    setSlotsError(null);
    onDateChange(nextDate, nextDateObj);
  }

  const isPrevDisabled = currentDate <= todayKeyInTimezone(context.timezone);
  const allSelected =
    activeServiceIds.length > 0 &&
    activeServiceIds.every(serviceId => selections[serviceId] != null);

  //CONSOLE PARA DEBUG
  // console.log("Step4BarberTime:", {
  //   // props recebidas
  //   serviceIds,
  //   date,
  //   dateObj,
  //   // estado interno
  //   currentDate,
  //   currentDateObj,
  //   activeServiceIds,
  //   eligibleBarberIds,
  //   selections,
  //   expandedBarbers,
  //   // dados externos
  //   barbers,
  //   services,
  //   openingHours,
  //   // slots carregados
  //   barbershopSlots,
  //   barbershopSlotsLoading,
  //   // flags
  //   isShopOpen,
  //   allSelected,
  // });

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => changeDate(-1)}
          disabled={isPrevDisabled}
          className="rounded-lg pr-1.5 transition-colors hover:bg-muted cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-sm font-semibold capitalize">
          {formatDateLabel(currentDateObj)}
        </p>

        <button
          onClick={() => changeDate(1)}
          className="rounded-lg pl-1.5 transition-colors hover:bg-muted cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!isShopOpen ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <AlertCircle className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">Barbearia fechada neste dia.</p>
          <p className="text-xs opacity-60">Escolha outra data.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeServiceIds.map((serviceId, index) => {
            const service = services.find(item => item.id === serviceId);
            if (!service) return null;

            return (
              <ServiceSection
                key={serviceId}
                index={index}
                service={service}
                barbers={barbers}
                eligibleBarberIds={eligibleBarberIds[serviceId] ?? []}
                selection={selections[serviceId] ?? null}
                expandedBarber={expandedBarbers[serviceId] ?? null}
                getSlots={barberId => computeSlots(serviceId, barberId)}
                getSlotsLoading={barberId =>
                  barbershopSlotsLoading[
                    `${serviceId}:${barberId}:${currentDate}`
                  ] ?? false
                }
                onToggleBarber={barberId =>
                  handleToggleBarber(serviceId, barberId)
                }
                onSelectTime={(barberId, time) =>
                  handleSelectTime(serviceId, barberId, time)
                }
                onClearSelection={() => handleClearSelection(serviceId)}
                onRemove={() => removeService(serviceId)}
                canRemove={activeServiceIds.length > 1}
              />
            );
          })}
        </div>
      )}

      {slotsError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {slotsError}
        </p>
      )}

      <Button
        onClick={() => {
          if (!allSelected) return;

          onSelect(
            activeServiceIds.map(serviceId => ({
              serviceId,
              barberId: selections[serviceId]!.barberId,
              time: selections[serviceId]!.time,
            })),
          );
        }}
        disabled={!allSelected || !isShopOpen}
        className="w-full rounded-full cursor-pointer"
      >
        Confirmar horarios
      </Button>
    </div>
  );
}
