import { Button } from "@/components/ui/button";
import { useBarbers } from "@/hooks/use-barbers";
import { useOpeningHours } from "@/hooks/use-opening-hours";
import { useServices } from "@/hooks/use-service";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeSlot {
  time: string;
  available: boolean;
}

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

interface BarberSlots {
  barberId: string;
  slots: TimeSlot[];
  loading: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localTimeToUTCMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  const offsetMinutes = new Date().getTimezoneOffset(); // +180 em Brasília
  return h * 60 + m + offsetMinutes; // converte local → UTC
}

function minutesToTime(m: number): string {
  return `${Math.floor(m / 60)
    .toString()
    .padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
}

function generateSlotsForPeriods(
  periods: { opens: number; closes: number }[],
): string[] {
  const slots: string[] = [];
  for (const { opens, closes } of periods) {
    let cur = opens;
    while (cur + 30 <= closes) {
      slots.push(minutesToTime(cur));
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
        opens: localTimeToUTCMinutes(r.starts_at!),
        closes: localTimeToUTCMinutes(r.ends_at!),
      }));
  }

  const shopEntries = shopHours.filter(
    r => r.day_of_week === dayOfWeek && r.is_open,
  );
  if (shopEntries.length === 0) return [];

  return shopEntries
    .sort((a, b) => a.period_order - b.period_order)
    .map(r => ({
      opens: localTimeToUTCMinutes(r.opens_at),
      closes: localTimeToUTCMinutes(r.closes_at),
    }));
}

// Manha: 04:00-12:30 | Tarde: 13:00-17:30 | Noite: 18:00-03:30 (next day)
function groupSlotsByPeriod(slots: TimeSlot[]): {
  manha: TimeSlot[];
  tarde: TimeSlot[];
  noite: TimeSlot[];
} {
  const manha: TimeSlot[] = [];
  const tarde: TimeSlot[] = [];
  const noite: TimeSlot[] = [];

  for (const slot of slots) {
    const min = localTimeToUTCMinutes(slot.time);
    if (
      min >= localTimeToUTCMinutes("04:00") &&
      min <= localTimeToUTCMinutes("12:30")
    ) {
      manha.push(slot);
    } else if (
      min >= localTimeToUTCMinutes("13:00") &&
      min <= localTimeToUTCMinutes("17:30")
    ) {
      tarde.push(slot);
    } else {
      noite.push(slot);
    }
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
  selectedTime,
  onSelect,
}: {
  title: string;
  slots: TimeSlot[];
  selectedTime: string | null;
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
                : selectedTime === slot.time
                  ? "border-primary bg-primary text-primary-foreground cursor-pointer"
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
  service,
  slots,
  loading,
  expanded,
  onToggle,
  selectedTime,
  onSelectTime,
}: {
  barber: { id: string; name: string; avatar_url: string | null };
  service: { price: number | null; duration_min: number | null } | undefined;
  slots: TimeSlot[];
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}) {
  const { manha, tarde, noite } = groupSlotsByPeriod(slots);
  const availableCount = slots.filter(s => s.available).length;
  const allOccupied = !loading && slots.length > 0 && availableCount === 0;
  const dayOff = !loading && slots.length === 0;

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition-all ${
        expanded ? "border-primary/60" : "border-border"
      }`}
    >
      {/* Header — clicável */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
      >
        {/* Left: avatar + name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
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

        {/* Right: price + duration + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          {service && (
            <div className="text-right hidden sm:block">
              {service.price && (
                <p className="text-sm font-semibold">
                  R$ {Number(service.price).toFixed(2).replace(".", ",")}
                </p>
              )}
              {service.duration_min && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="h-3 w-3" />
                  {service.duration_min} min
                </p>
              )}
            </div>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded slots */}
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
          ) : allOccupied ? (
            // <div className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground">
            //   <AlertCircle className="h-5 w-5 opacity-40" />
            //   <p className="text-sm">Todos os horários estão ocupados.</p>
            // </div>
            <>
              <SlotGroup
                title="Manhã"
                slots={manha}
                selectedTime={selectedTime}
                onSelect={onSelectTime}
              />
              <SlotGroup
                title="Tarde"
                slots={tarde}
                selectedTime={selectedTime}
                onSelect={onSelectTime}
              />
              <SlotGroup
                title="Noite"
                slots={noite}
                selectedTime={selectedTime}
                onSelect={onSelectTime}
              />
            </>
          ) : (
            <>
              <SlotGroup
                title="Manhã"
                slots={manha}
                selectedTime={selectedTime}
                onSelect={onSelectTime}
              />
              <SlotGroup
                title="Tarde"
                slots={tarde}
                selectedTime={selectedTime}
                onSelect={onSelectTime}
              />
              <SlotGroup
                title="Noite"
                slots={noite}
                selectedTime={selectedTime}
                onSelect={onSelectTime}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step4BarberTime ──────────────────────────────────────────────────────────

export function Step4BarberTime({
  serviceId,
  date,
  dateObj,
  onBack,
  onSelect,
  onDateChange,
}: {
  serviceId: string;
  date: string;
  dateObj: Date;
  onBack: () => void;
  onSelect: (barberId: string, time: string) => void;
  onDateChange: (date: string, dateObj: Date) => void;
}) {
  const { barbershop } = useBarbershopStore();
  const { openingHours } = useOpeningHours();
  const { barbers } = useBarbers();
  const { services } = useServices();

  const service = services.find(s => s.id === serviceId);

  const [currentDate, setCurrentDate] = useState(date);
  const [currentDateObj, setCurrentDateObj] = useState(dateObj);

  const [eligibleBarberIds, setEligibleBarberIds] = useState<string[]>([]);
  const [barberSlots, setBarberSlots] = useState<Record<string, BarberSlots>>(
    {},
  );
  const [expandedBarber, setExpandedBarber] = useState<string | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Load eligible barbers for this service
  useEffect(() => {
    supabase
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", serviceId)
      .then(({ data }) => {
        setEligibleBarberIds(data?.map(r => r.barber_id) ?? []);
      });
  }, [serviceId]);

  const visibleBarbers = barbers.filter(
    b => b.is_active && eligibleBarberIds.includes(b.id),
  );

  const isShopOpen = openingHours.some(
    h => h.day_of_week === currentDateObj.getDay() && h.is_open,
  );

  async function loadBarberSlots(barberId: string, dateStr: string) {
    if (!barbershop?.id || !service) return;

    setBarberSlots(prev => ({
      ...prev,
      [barberId]: { barberId, slots: [], loading: true },
    }));

    const durationMin = service.duration_min ?? 30;
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();

    const { data: shopHours } = await supabase
      .from("opening_hours")
      .select("day_of_week, opens_at, closes_at, is_open, period_order")
      .eq("barbershop_id", barbershop.id)
      .eq("day_of_week", dayOfWeek);

    const { data: barberAvail } = await supabase
      .from("barber_availability")
      .select(
        "day_of_week, is_day_off, use_custom_hours, starts_at, ends_at, period_order",
      )
      .eq("barber_id", barberId)
      .eq("day_of_week", dayOfWeek);

    const periods = resolveWorkingPeriods(
      dayOfWeek,
      (shopHours as OpeningHourRow[]) ?? [],
      (barberAvail as BarberAvailabilityRow[]) ?? [],
    );

    if (periods.length === 0) {
      setBarberSlots(prev => ({
        ...prev,
        [barberId]: { barberId, slots: [], loading: false },
      }));
      return;
    }

    const allSlotTimes = generateSlotsForPeriods(periods);

    const dayStart = `${dateStr}T00:00:00`;
    const dayEnd = `${dateStr}T23:59:59`;

    const { data: existingApts } = await supabase
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("barber_id", barberId)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);

    const activeApts = (existingApts ?? []).filter(
      a => a.status !== "cancelled",
    );

    const now = new Date();

    const timeSlots: TimeSlot[] = allSlotTimes.map(time => {
      const slotStart = new Date(`${dateStr}T${time}:00Z`);
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000);

      if (slotStart <= now) return { time, available: false };

      const overlaps = activeApts.some(apt => {
        const aptStart = new Date(apt.starts_at);
        const aptEnd = new Date(apt.ends_at);
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      return { time, available: !overlaps };
    });

    setBarberSlots(prev => ({
      ...prev,
      [barberId]: { barberId, slots: timeSlots, loading: false },
    }));
  }

  // Load slots for expanded barber when date or expanded barber changes
  useEffect(() => {
    if (!expandedBarber) return;
    void (async () => {
      await loadBarberSlots(expandedBarber, currentDate);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedBarber, currentDate]);

  function handleToggleBarber(barberId: string) {
    if (expandedBarber === barberId) {
      setExpandedBarber(null);
    } else {
      setExpandedBarber(barberId);
      setSelectedBarber(null);
      setSelectedTime(null);
    }
  }

  function handleSelectTime(barberId: string, time: string) {
    setSelectedBarber(barberId);
    setSelectedTime(time);
  }

  function changeDate(delta: number) {
    const next = new Date(currentDateObj);
    next.setDate(next.getDate() + delta);
    setCurrentDateObj(next);
    const nextIso = next.toLocaleDateString("en-CA");
    setCurrentDate(nextIso);
    setExpandedBarber(null);
    setSelectedBarber(null);
    setSelectedTime(null);
    setBarberSlots({});
    onDateChange(nextIso, next);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPrevDisabled = currentDateObj <= today;

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

      {/* Barber cards */}
      <div className="flex flex-col gap-3">
        {!isShopOpen ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">Barbearia fechada neste dia.</p>
            <p className="text-xs opacity-60">Escolha outra data.</p>
          </div>
        ) : visibleBarbers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum profissional disponível para este serviço.
          </p>
        ) : (
          <>
            {visibleBarbers.map(b => (
              <BarberCard
                key={b.id}
                barber={b}
                service={service}
                slots={barberSlots[b.id]?.slots ?? []}
                loading={barberSlots[b.id]?.loading ?? false}
                expanded={expandedBarber === b.id}
                onToggle={() => handleToggleBarber(b.id)}
                selectedTime={selectedBarber === b.id ? selectedTime : null}
                onSelectTime={t => handleSelectTime(b.id, t)}
              />
            ))}
          </>
        )}
      </div>

      <Button
        onClick={() => {
          if (selectedBarber && selectedTime)
            onSelect(selectedBarber, selectedTime);
        }}
        disabled={!selectedBarber || !selectedTime}
        className="cursor-pointer w-full"
      >
        Confirmar horário
      </Button>
    </div>
  );
}
