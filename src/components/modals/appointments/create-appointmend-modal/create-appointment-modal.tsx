import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  CalendarDays,
  Clock,
  User,
  Scissors,
  Sparkles,
  Phone,
  Search,
  ChevronLeft,
  Check,
  UserPlus,
  Users,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/supabase";
import { useCustomers } from "@/hooks/use-customers";
import { useBarbers } from "@/hooks/use-barbers";
import { useServices } from "@/hooks/use-service";
import { useBarbershopStore } from "@/store/barbershop.store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3;
type CustomerMode = "existing" | "new" | null;

interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  isNew?: boolean;
}

interface TimeSlot {
  time: string; // "HH:MM"
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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

/**
 * Resolve working periods for a barber on a given day_of_week.
 *
 * Priority:
 *  1. barber has is_day_off = true  → returns []
 *  2. barber has use_custom_hours = true  → uses barber's starts_at/ends_at
 *  3. falls back to barbershop opening_hours
 */
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

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Cliente" },
    { n: 2, label: "Serviço" },
    { n: 3, label: "Horário" },
  ] as const;

  return (
    <div className="flex items-center justify-center px-6 py-4 bg-muted/20 shrink-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                current > s.n
                  ? "bg-primary text-primary-foreground"
                  : current === s.n
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {current > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span
              className={`text-[10px] font-medium whitespace-nowrap minx-w-36 ${
                current === s.n ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px min-w-18 mx-2 mb-4 transition-all duration-300 ${
                current > s.n ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  icon,
  children,
  error,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </label>
      {children}
      {error && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}

const INPUT_CLS =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60";

// ─── Step 1: Customer ─────────────────────────────────────────────────────────

function Step1Customer({
  onSelect,
}: {
  onSelect: (customer: SelectedCustomer) => void;
}) {
  const { customers, loading } = useCustomers();
  const { barbershop } = useBarbershopStore();
  const [mode, setMode] = useState<CustomerMode>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const filtered = customers.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.replace(/\D/g, "").includes(search.replace(/\D/g, "")),
  );

  async function handleCreateCustomer() {
    if (!newName.trim() || !newPhone.trim()) return;
    setSubmitting(true);
    setError(null);
    setPhoneError(null);

    const digits = newPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("Telefone inválido. Digite DDD + número.");
      setSubmitting(false);
      return;
    }

    const { data: existing } = await supabase
      .from("customers")
      .select("id, name")
      .eq("barbershop_id", barbershop!.id)
      .eq("phone", digits)
      .maybeSingle();

    if (existing) {
      setPhoneError(`Telefone já cadastrado para "${existing.name}".`);
      setSubmitting(false);
      return;
    }

    const { data, error: err } = await supabase
      .from("customers")
      .insert({
        barbershop_id: barbershop!.id,
        name: newName.trim(),
        phone: digits,
      })
      .select()
      .single();

    if (err || !data) {
      setError("Erro ao criar cliente. Tente novamente.");
      setSubmitting(false);
      return;
    }

    onSelect({ id: data.id, name: data.name, phone: data.phone, isNew: true });
    setSubmitting(false);
  }

  if (mode === null) {
    return (
      <div className="flex flex-col gap-4 px-6 py-6">
        <p className="text-sm text-muted-foreground text-center">
          O cliente já possui cadastro?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              key: "existing" as const,
              icon: <Users className="h-6 w-6" />,
              title: "Cliente existente",
              sub: "Buscar na lista",
            },
            {
              key: "new" as const,
              icon: <UserPlus className="h-6 w-6" />,
              title: "Novo cliente",
              sub: "Cadastrar agora",
            },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors text-muted-foreground group-hover:text-primary">
                {opt.icon}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{opt.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {opt.sub}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "existing") {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <button
          onClick={() => setMode(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            autoFocus
          />
        </div>

        <div className="flex flex-col max-h-60 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando…
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() =>
                  onSelect({ id: c.id, name: c.name, phone: c.phone ?? "" })
                }
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{c.name}</span>
                </div>
                {c.phone && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatPhone(c.phone)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <button
        onClick={() => setMode(null)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <Field label="Nome completo" icon={<User className="h-3.5 w-3.5" />}>
        <input
          type="text"
          placeholder="Ex: João Silva"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className={INPUT_CLS}
          autoFocus
        />
      </Field>

      <Field
        label="Telefone / WhatsApp"
        icon={<Phone className="h-3.5 w-3.5" />}
        error={phoneError}
      >
        <input
          type="text"
          placeholder="(11) 99999-9999"
          value={newPhone}
          onChange={e => setNewPhone(formatPhone(e.target.value))}
          className={INPUT_CLS}
          maxLength={15}
        />
      </Field>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      <Button
        onClick={handleCreateCustomer}
        disabled={!newName.trim() || !newPhone.trim() || submitting}
        className="cursor-pointer w-full"
      >
        {submitting ? "Cadastrando…" : "Cadastrar e continuar"}
      </Button>
    </div>
  );
}

// ─── Step 2: Service + Barber ─────────────────────────────────────────────────

function Step2ServiceBarber({
  onSelect,
}: {
  onSelect: (serviceId: string, barberId: string) => void;
}) {
  const { services, loading: loadingServices } = useServices();
  const { barbers, loading: loadingBarbers } = useBarbers();

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [eligibleBarberIds, setEligibleBarberIds] = useState<string[] | null>(
    null,
  );
  const [loadingEligible, setLoadingEligible] = useState(false);

  async function handleSelectService(id: string) {
    setSelectedService(id);
    setSelectedBarber(null);
    setLoadingEligible(true);

    // Fetch barbers that offer this service via barber_services join table
    const { data } = await supabase
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", id);

    setEligibleBarberIds(data ? data.map(r => r.barber_id) : []);
    setLoadingEligible(false);
  }

  const activeBarbers = barbers.filter(b => b.is_active);
  const visibleBarbers =
    eligibleBarberIds === null
      ? activeBarbers
      : activeBarbers.filter(b => eligibleBarberIds.includes(b.id));

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {/* Services */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Serviço
        </label>

        {loadingServices ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services
              .filter(s => s.is_active)
              .map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectService(s.id)}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selectedService === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.duration_min ? `${s.duration_min} min` : ""}
                    {s.duration_min && s.price ? " · " : ""}
                    {s.price
                      ? `R$ ${Number(s.price).toFixed(2).replace(".", ",")}`
                      : ""}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Barbers — appear after service chosen */}
      {selectedService && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Scissors className="h-3.5 w-3.5" />
            Barbeiro
          </label>

          {loadingBarbers || loadingEligible ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : visibleBarbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum barbeiro disponível para este serviço.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleBarbers.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBarber(b.id)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedBarber === b.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {b.avatar_url ? (
                      <img
                        src={b.avatar_url}
                        alt={b.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{b.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        onClick={() =>
          selectedService &&
          selectedBarber &&
          onSelect(selectedService, selectedBarber)
        }
        disabled={!selectedService || !selectedBarber}
        className="cursor-pointer w-full mt-1"
      >
        Continuar
      </Button>
    </div>
  );
}

// ─── Step 3: Date + Time ──────────────────────────────────────────────────────

function Step3DateTime({
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

// ─── Confirm ──────────────────────────────────────────────────────────────────

function ConfirmStep({
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
      value: formatPhone(customer.phone),
    },
    {
      icon: <Sparkles className="h-3.5 w-3.5" />,
      label: "Serviço",
      value: service?.name ?? "—",
    },
    {
      icon: <Scissors className="h-3.5 w-3.5" />,
      label: "Barbeiro",
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
    <div className="flex flex-col gap-4 px-6 py-5">
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

      <div className="flex gap-2">
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

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function CreateAppointmentModal({
  open,
  onClose,
  onSuccess,
}: CreateAppointmentModalProps) {
  const { barbershop } = useBarbershopStore();
  const { services } = useServices();

  const [step, setStep] = useState<Step>(1);
  const [showConfirm, setShowConfirm] = useState(false);

  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setShowConfirm(false);
    setCustomer(null);
    setServiceId(null);
    setBarberId(null);
    setDate(null);
    setTime(null);
    setSubmitting(false);
    setSubmitError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  function handleBack() {
    if (showConfirm) {
      // Back from confirm → re-show step 3, reset date/time
      setShowConfirm(false);
      setDate(null);
      setTime(null);
    } else {
      setStep(s => (s - 1) as Step);
    }
  }

  async function handleConfirm() {
    if (!customer || !serviceId || !barberId || !date || !time || !barbershop)
      return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const service = services.find(s => s.id === serviceId);
      const durationMin = service?.duration_min ?? 30;
      const startsAt = new Date(`${date}T${time}:00`);
      const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

      const { error: err } = await supabase.from("appointments").insert({
        barbershop_id: barbershop.id,
        customer_id: customer.id,
        barber_id: barberId,
        service_id: serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "scheduled",
      });

      if (err) throw err;

      onSuccess?.();
      handleClose();
    } catch {
      setSubmitError("Erro ao criar agendamento. Tente novamente.");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canGoBack = (step > 1 && !showConfirm) || showConfirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative z-10 w-full max-w-xl mx-4 rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer mr-1"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {showConfirm ? "Confirmar agendamento" : "Novo agendamento"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator (hidden on confirm screen) */}
        {!showConfirm && <StepIndicator current={step} />}

        {/* Body */}
        <div className="overflow-y-auto">
          {!showConfirm && step === 1 && (
            <Step1Customer
              onSelect={c => {
                setCustomer(c);
                setStep(2);
              }}
            />
          )}

          {!showConfirm && step === 2 && (
            <Step2ServiceBarber
              onSelect={(sId, bId) => {
                setServiceId(sId);
                setBarberId(bId);
                setStep(3);
              }}
            />
          )}

          {!showConfirm && step === 3 && barberId && serviceId && (
            <Step3DateTime
              barberId={barberId}
              serviceId={serviceId}
              onSelect={(d, t) => {
                setDate(d);
                setTime(t);
                setShowConfirm(true);
              }}
            />
          )}

          {showConfirm && customer && serviceId && barberId && date && time && (
            <ConfirmStep
              customer={customer}
              serviceId={serviceId}
              barberId={barberId}
              date={date}
              time={time}
              onConfirm={handleConfirm}
              onClose={handleClose}
              submitting={submitting}
              error={submitError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
