import { Button } from "@/components/ui/button";
import { useBarbers } from "@/hooks/use-barbers";
import { useOpeningHours } from "@/hooks/use-opening-hours";
import { useServices } from "@/hooks/use-service";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { ServiceSelection, TimeSlot } from "@/types/create-appointment";
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
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpeningHourRow {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_open: boolean;
  period_order: number;
}

interface BarberAvailabilityRow {
  day_of_week: number;
  is_day_off: boolean;
  use_custom_hours: boolean;
  starts_at: string | null;
  ends_at: string | null;
  period_order: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRT_OFFSET_MINUTES = 3 * 60;

function brTimeToUTCMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m + BRT_OFFSET_MINUTES;
}

function utcMinutesToBRTime(utcMin: number): string {
  const brMin = utcMin - BRT_OFFSET_MINUTES;
  const h = Math.floor(brMin / 60);
  const m = brMin % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function generateSlotsForPeriods(
  periods: { opens: number; closes: number }[],
): string[] {
  const slots: string[] = [];
  for (const { opens, closes } of periods) {
    let cur = opens;
    while (cur + 30 <= closes) {
      slots.push(utcMinutesToBRTime(cur));
      cur += 30;
    }
  }
  return [...new Set(slots)].sort();
}

function resolveWorkingPeriods(
  dayOfWeek: number,
  shopHours: OpeningHourRow[],
  barberAvailability: BarberAvailabilityRow[],
): { opens: number; closes: number }[] {
  const barberEntries = barberAvailability.filter(
    r => r.day_of_week === dayOfWeek,
  );
  if (barberEntries.some(r => r.is_day_off)) return [];

  const customEntries = barberEntries.filter(
    r => r.use_custom_hours && r.starts_at && r.ends_at,
  );
  if (customEntries.length > 0) {
    return customEntries
      .sort((a, b) => a.period_order - b.period_order)
      .map(r => ({
        opens: brTimeToUTCMinutes(r.starts_at!.slice(0, 5)),
        closes: brTimeToUTCMinutes(r.ends_at!.slice(0, 5)),
      }));
  }

  const shopEntries = shopHours.filter(
    r => r.day_of_week === dayOfWeek && r.is_open,
  );
  if (shopEntries.length === 0) return [];

  return shopEntries
    .sort((a, b) => a.period_order - b.period_order)
    .map(r => ({
      opens: brTimeToUTCMinutes(r.opens_at.slice(0, 5)),
      closes: brTimeToUTCMinutes(r.closes_at.slice(0, 5)),
    }));
}

function groupSlotsByPeriod(slots: TimeSlot[]) {
  const manha: TimeSlot[] = [];
  const tarde: TimeSlot[] = [];
  const noite: TimeSlot[] = [];

  for (const slot of slots) {
    const [h, m] = slot.time.split(":").map(Number);
    const totalMin = h * 60 + m;
    if (totalMin >= 4 * 60 && totalMin <= 12 * 60 + 30) manha.push(slot);
    else if (totalMin >= 13 * 60 && totalMin <= 17 * 60 + 30) tarde.push(slot);
    else noite.push(slot);
  }

  return { manha, tarde, noite };
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

// ─── SlotGroup ────────────────────────────────────────────────────────────────

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

  const hasAvailable = slots.some(s => s.available);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        {!hasAvailable && (
          <span className="text-xs text-muted-foreground/50">— lotado</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.map(slot => (
          <button
            key={slot.time}
            disabled={!slot.available}
            onClick={() => slot.available && onSelect(slot.time)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
              !slot.available
                ? "border-border/40 bg-muted/20 text-muted-foreground/35 cursor-not-allowed line-through"
                : "border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
            }`}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── BarberCard ───────────────────────────────────────────────────────────────

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

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition-all ${
        expanded ? "border-primary/60" : "border-border"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {barber.avatar_url ? (
              <img
                src={barber.avatar_url}
                alt={barber.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{barber.name}</p>
            {loading && (
              <p className="text-xs text-muted-foreground/60">Verificando…</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {durationMin && (
            <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
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
        <div className="px-4 pb-4 pt-2 border-t border-border flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Verificando disponibilidade…
            </p>
          ) : dayOff ? (
            <div className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground">
              <AlertCircle className="h-5 w-5 opacity-40" />
              <p className="text-sm">Sem atendimento neste dia.</p>
            </div>
          ) : (
            <>
              <SlotGroup title="Manhã" slots={manha} onSelect={onSelectTime} />
              <SlotGroup title="Tarde" slots={tarde} onSelect={onSelectTime} />
              <SlotGroup title="Noite" slots={noite} onSelect={onSelectTime} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ServiceSection ───────────────────────────────────────────────────────────

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
    b => b.is_active && eligibleBarberIds.includes(b.id),
  );
  const selectedBarber = selection
    ? barbers.find(b => b.id === selection.barberId)
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      {/* Service header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
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

        <div className="flex items-center gap-2 shrink-0">
          {selection && (
            <button
              onClick={onClearSelection}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
              Alterar
            </button>
          )}
          <button
            onClick={onRemove}
            disabled={!canRemove}
            title="Remover serviço"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Selection summary or barber list */}
      {selection ? (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Check className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium">
            {selectedBarber?.name ?? "—"} às {selection.time}
          </span>
        </div>
      ) : visibleBarbers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          Nenhum profissional disponível para este serviço.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleBarbers.map(b => (
            <BarberCard
              key={b.id}
              barber={b}
              durationMin={service.duration_min}
              slots={getSlots(b.id)}
              loading={getSlotsLoading(b.id)}
              expanded={expandedBarber === b.id}
              onToggle={() => onToggleBarber(b.id)}
              onSelectTime={time => onSelectTime(b.id, time)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step4BarberTime ──────────────────────────────────────────────────────────

export function Step4BarberTime({
  serviceIds,
  date,
  dateObj,
  onBack,
  onSelect,
  onDateChange,
}: {
  serviceIds: string[];
  date: string;
  dateObj: Date;
  onBack: () => void;
  onSelect: (selections: ServiceSelection[]) => void;
  onDateChange: (date: string, dateObj: Date) => void;
}) {
  const { barbershop } = useBarbershopStore();
  const { openingHours } = useOpeningHours();
  const { barbers } = useBarbers();
  const { services } = useServices();

  const [currentDate, setCurrentDate] = useState(date);
  const [currentDateObj, setCurrentDateObj] = useState(dateObj);

  // local copy of serviceIds — allows removing services in this step
  const [activeServiceIds, setActiveServiceIds] = useState(serviceIds);

  // eligibleBarberIds[serviceId] = barber_id[]
  const [eligibleBarberIds, setEligibleBarberIds] = useState<
    Record<string, string[]>
  >({});

  // barberSlots[`${serviceId}:${barberId}`] = raw TimeSlot[] from DB
  const [barberSlots, setBarberSlots] = useState<Record<string, TimeSlot[]>>(
    {},
  );
  const [barberSlotsLoading, setBarberSlotsLoading] = useState<
    Record<string, boolean>
  >({});

  // expandedBarbers[serviceId] = barberId | null
  const [expandedBarbers, setExpandedBarbers] = useState<
    Record<string, string | null>
  >({});

  // selections[serviceId] = { barberId, time } | null
  const [selections, setSelections] = useState<
    Record<string, { barberId: string; time: string } | null>
  >({});

  const isShopOpen = openingHours.some(
    h => h.day_of_week === currentDateObj.getDay() && h.is_open,
  );

  // Load eligible barbers for all services on mount
  useEffect(() => {
    if (serviceIds.length === 0) return;
    supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .in("service_id", serviceIds)
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        for (const row of data ?? []) {
          if (!map[row.service_id]) map[row.service_id] = [];
          map[row.service_id].push(row.barber_id);
        }
        setEligibleBarberIds(map);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBarberSlots(
    serviceId: string,
    barberId: string,
    dateStr: string,
  ) {
    if (!barbershop?.id) return;
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    const key = `${serviceId}:${barberId}`;
    setBarberSlotsLoading(prev => ({ ...prev, [key]: true }));

    const durationMin = service.duration_min ?? 30;
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();

    const [{ data: shopHours }, { data: barberAvail }] = await Promise.all([
      supabase
        .from("opening_hours")
        .select("day_of_week, opens_at, closes_at, is_open, period_order")
        .eq("barbershop_id", barbershop.id)
        .eq("day_of_week", dayOfWeek),
      supabase
        .from("barber_availability")
        .select(
          "day_of_week, is_day_off, use_custom_hours, starts_at, ends_at, period_order",
        )
        .eq("barber_id", barberId)
        .eq("day_of_week", dayOfWeek),
    ]);

    const periods = resolveWorkingPeriods(
      dayOfWeek,
      (shopHours as OpeningHourRow[]) ?? [],
      (barberAvail as BarberAvailabilityRow[]) ?? [],
    );

    if (periods.length === 0) {
      setBarberSlots(prev => ({ ...prev, [key]: [] }));
      setBarberSlotsLoading(prev => ({ ...prev, [key]: false }));
      return;
    }

    const allSlotTimes = generateSlotsForPeriods(periods);

    const { data: existingApts } = await supabase
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("barber_id", barberId)
      .gte("starts_at", `${dateStr}T00:00:00Z`)
      .lte("starts_at", `${dateStr}T23:59:59Z`);

    const activeApts = (existingApts ?? []).filter(
      a =>
        a.status !== "cancelled_by_customer" &&
        a.status !== "cancelled_by_barbershop",
    );

    const nowNaive = new Date(new Date().getTime() - (3 * 60 + 20) * 60 * 1000);

    const timeSlots: TimeSlot[] = allSlotTimes.map(time => {
      const slotStart = new Date(`${dateStr}T${time}:00Z`);
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000);

      if (slotStart <= nowNaive) return { time, available: false };

      const overlaps = activeApts.some(apt => {
        const aptStart = new Date(apt.starts_at);
        const aptEnd = new Date(apt.ends_at);
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      return { time, available: !overlaps };
    });

    setBarberSlots(prev => ({ ...prev, [key]: timeSlots }));
    setBarberSlotsLoading(prev => ({ ...prev, [key]: false }));
  }

  // Returns slots with in-session conflict overlay applied
  function computeSlots(serviceId: string, barberId: string): TimeSlot[] {
    const key = `${serviceId}:${barberId}`;
    const raw = barberSlots[key] ?? [];
    const service = services.find(s => s.id === serviceId);
    const durationMin = service?.duration_min ?? 30;

    return raw.map(slot => {
      if (!slot.available) return slot;

      const hasConflict = Object.entries(selections).some(
        ([otherServiceId, sel]) => {
          if (otherServiceId === serviceId || !sel || sel.barberId !== barberId)
            return false;
          const otherService = services.find(s => s.id === otherServiceId);
          const otherDuration = otherService?.duration_min ?? 30;
          const slotStart = new Date(`${currentDate}T${slot.time}:00Z`);
          const slotEnd = new Date(
            slotStart.getTime() + durationMin * 60 * 1000,
          );
          const otherStart = new Date(`${currentDate}T${sel.time}:00Z`);
          const otherEnd = new Date(
            otherStart.getTime() + otherDuration * 60 * 1000,
          );
          return slotStart < otherEnd && slotEnd > otherStart;
        },
      );

      return { ...slot, available: !hasConflict };
    });
  }

  function handleToggleBarber(serviceId: string, barberId: string) {
    const isCollapsing = expandedBarbers[serviceId] === barberId;
    setExpandedBarbers(prev => ({
      ...prev,
      [serviceId]: isCollapsing ? null : barberId,
    }));

    if (!isCollapsing) {
      const key = `${serviceId}:${barberId}`;
      if (barberSlots[key] === undefined && !barberSlotsLoading[key]) {
        void loadBarberSlots(serviceId, barberId, currentDate);
      }
    }
  }

  function handleSelectTime(serviceId: string, barberId: string, time: string) {
    setSelections(prev => ({ ...prev, [serviceId]: { barberId, time } }));
    setExpandedBarbers(prev => ({ ...prev, [serviceId]: null }));
  }

  function handleClearSelection(serviceId: string) {
    setSelections(prev => ({ ...prev, [serviceId]: null }));
  }

  function removeService(serviceId: string) {
    setActiveServiceIds(prev => prev.filter(id => id !== serviceId));
    setSelections(prev => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
    setExpandedBarbers(prev => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }

  function changeDate(delta: number) {
    const next = new Date(currentDateObj);
    next.setDate(next.getDate() + delta);
    setCurrentDateObj(next);
    const nextIso = next.toLocaleDateString("en-CA");
    setCurrentDate(nextIso);
    setExpandedBarbers({});
    setSelections({});
    setBarberSlots({});
    setBarberSlotsLoading({});
    onDateChange(nextIso, next);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPrevDisabled = currentDateObj <= today;

  const allSelected =
    activeServiceIds.length > 0 &&
    activeServiceIds.every(id => selections[id] != null);

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      {/* Date navigator */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => changeDate(-1)}
          disabled={isPrevDisabled}
          className="pr-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-sm font-semibold capitalize">
          {formatDateLabel(currentDateObj)}
        </p>

        <button
          onClick={() => changeDate(1)}
          className="pl-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      {!isShopOpen ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <AlertCircle className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">Barbearia fechada neste dia.</p>
          <p className="text-xs opacity-60">Escolha outra data.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeServiceIds.map((serviceId, index) => {
            const service = services.find(s => s.id === serviceId);
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
                  barberSlotsLoading[`${serviceId}:${barberId}`] ?? false
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

      <Button
        onClick={() => {
          if (allSelected) {
            onSelect(
              activeServiceIds.map(id => ({
                serviceId: id,
                barberId: selections[id]!.barberId,
                time: selections[id]!.time,
              })),
            );
          }
        }}
        disabled={!allSelected || !isShopOpen}
        className="cursor-pointer w-full"
      >
        Confirmar horários
      </Button>
    </div>
  );
}
