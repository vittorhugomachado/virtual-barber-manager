import { useServices } from "@/hooks/use-service";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { AlertCircle, CalendarDays, Clock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Field } from "./field";
import { Button } from "@/components/ui/button";

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

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${Math.floor(m / 60)
    .toString()
    .padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
}

function generateSlotsForPeriods(
  periods: { opens: number; closes: number }[],
  durationMin: number,
): string[] {
  const slots: string[] = [];
  for (const { opens, closes } of periods) {
    let cur = opens;
    while (cur + durationMin <= closes) {
      slots.push(minutesToTime(cur));
      cur += durationMin;
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
        opens: timeToMinutes(r.starts_at!),
        closes: timeToMinutes(r.ends_at!),
      }));
  }

  const shopEntries = shopHours.filter(
    r => r.day_of_week === dayOfWeek && r.is_open,
  );
  if (shopEntries.length === 0) return [];

  return shopEntries
    .sort((a, b) => a.period_order - b.period_order)
    .map(r => ({
      opens: timeToMinutes(r.opens_at),
      closes: timeToMinutes(r.closes_at),
    }));
}

export function Step3DateTime({
  barberId,
  serviceId,
  onSelect,
}: {
  barberId: string;
  serviceId: string;
  onSelect: (date: string, time: string) => void;
}) {
  const { barbershop } = useBarbershopStore();
  const { services } = useServices();

  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const loadSlots = useCallback(
    async (date: string) => {
      if (!date || !barberId || !serviceId || !barbershop?.id) return;
      setLoadingSlots(true);
      setSelectedTime(null);

      const service = services.find(s => s.id === serviceId);
      const durationMin = service?.duration_min ?? 30;

      // day_of_week: 0 = Sunday … 6 = Saturday (matches Supabase column)
      const dayOfWeek = new Date(date + "T00:00:00").getDay();

      // 1. Barbershop opening hours for this weekday
      const { data: shopHours } = await supabase
        .from("opening_hours")
        .select("day_of_week, opens_at, closes_at, is_open, period_order")
        .eq("barbershop_id", barbershop.id)
        .eq("day_of_week", dayOfWeek);

      // 2. Barber availability for this weekday
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
        setSlots([]);
        setLoadingSlots(false);
        return;
      }

      const allSlotTimes = generateSlotsForPeriods(periods, durationMin);

      // 3. Existing non-cancelled appointments for this barber on this date
      const dayStart = new Date(`${date}T00:00:00`).toISOString();
      const dayEnd = new Date(`${date}T23:59:59`).toISOString();

      const { data: existingApts } = await supabase
        .from("appointments")
        .select("starts_at, ends_at")
        .eq("barber_id", barberId)
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd)
        .neq("status", "cancelled");

      const now = new Date();

      const timeSlots: TimeSlot[] = allSlotTimes.map(time => {
        const slotStart = new Date(`${date}T${time}:00`);
        const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000);

        // Already passed
        if (slotStart <= now) return { time, available: false };

        // Overlap with existing appointment
        const overlaps = (existingApts ?? []).some(apt => {
          const aptStart = new Date(apt.starts_at);
          const aptEnd = new Date(apt.ends_at);
          return slotStart < aptEnd && slotEnd > aptStart;
        });

        return { time, available: !overlaps };
      });

      setSlots(timeSlots);
      setLoadingSlots(false);
    },
    [barberId, serviceId, services, barbershop],
  );

  useEffect(() => {
    if (!selectedDate) return;
    void (async () => {
      await loadSlots(selectedDate);
    })();
  }, [selectedDate, loadSlots]);

  const available = slots.filter(s => s.available);
  const occupied = slots.filter(s => !s.available).length;
  const isDayOff = selectedDate && !loadingSlots && slots.length === 0;
  const allOccupied =
    selectedDate && !loadingSlots && slots.length > 0 && available.length === 0;

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <Field label="Data" icon={<CalendarDays className="h-3.5 w-3.5" />}>
        <div className="relative flex items-center">
          <input
            type="date"
            value={selectedDate}
            min={todayStr}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ colorScheme: "light" }}
            className="h-9 w-full rounded-md border border-border bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
          <CalendarDays className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </Field>

      {selectedDate && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Horários disponíveis
          </label>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              Verificando disponibilidade…
            </div>
          ) : isDayOff ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-muted-foreground">
              <AlertCircle className="h-5 w-5 opacity-40" />
              <p className="text-sm">Sem atendimento neste dia.</p>
              <p className="text-xs opacity-60">Tente escolher outra data.</p>
            </div>
          ) : allOccupied ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-muted-foreground">
              <AlertCircle className="h-5 w-5 opacity-40" />
              <p className="text-sm">Todos os horários estão ocupados.</p>
              <p className="text-xs opacity-60">Tente escolher outra data.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto py-1 pr-1">
                {slots.map(slot => (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => slot.available && setSelectedTime(slot.time)}
                    className={`px-3.5 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
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

              <p className="text-xs text-muted-foreground">
                {available.length} disponíve
                {available.length !== 1 ? "is" : "l"}
                {occupied > 0
                  ? ` · ${occupied} ocupado${occupied !== 1 ? "s" : ""}`
                  : ""}
              </p>
            </>
          )}
        </div>
      )}

      <Button
        onClick={() =>
          selectedDate && selectedTime && onSelect(selectedDate, selectedTime)
        }
        disabled={!selectedDate || !selectedTime}
        className="cursor-pointer w-full mt-1"
      >
        Confirmar horário
      </Button>
    </div>
  );
}
