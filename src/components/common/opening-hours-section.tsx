import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOpeningHours } from "@/hooks/use-opening-hours";
import { upsertOpeningHours } from "@/lib/supabase/opening-hours/upsert-opening-hours";
import { useBarbershopStore } from "@/store/barbershop.store";
import { DAY_LABELS } from "@/types/opening-hours";
import type { OpeningHours } from "@/types/opening-hours";
import { Loader2, Plus, Trash2 } from "lucide-react";

type PeriodEntry = Omit<OpeningHours, "id">;

type DayConfig = {
  day_of_week: number;
  is_open: boolean;
  periods: { opens_at: string; closes_at: string }[];
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
    .toString()
    .padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const DEFAULT_DAYS: DayConfig[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  is_open: i !== 0,
  periods: [{ opens_at: "08:00", closes_at: "18:00" }],
}));

function toDayConfigs(hours: OpeningHours[]): DayConfig[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dayHours = hours
      .filter(h => h.day_of_week === i)
      .sort((a, b) => a.period_order - b.period_order);

    if (dayHours.length === 0) {
      return {
        day_of_week: i,
        is_open: false,
        periods: [{ opens_at: "08:00", closes_at: "18:00" }],
      };
    }

    return {
      day_of_week: i,
      is_open: dayHours[0].is_open,
      periods: dayHours.map(h => ({
        opens_at: h.opens_at.slice(0, 5),
        closes_at: h.closes_at.slice(0, 5),
      })),
    };
  });
}

function toPeriodEntries(
  days: DayConfig[],
  barbershopId: string,
): PeriodEntry[] {
  return days.flatMap(day =>
    day.periods.map((p, idx) => ({
      barbershop_id: barbershopId,
      day_of_week: day.day_of_week,
      is_open: day.is_open,
      opens_at: p.opens_at,
      closes_at: p.closes_at,
      period_order: idx,
    })),
  );
}

export function OpeningHoursSection() {
  const { barbershop } = useBarbershopStore();
  const { openingHours, loading } = useOpeningHours();
  const [initialDays, setInitialDays] = useState<DayConfig[]>(DEFAULT_DAYS);
  const [days, setDays] = useState<DayConfig[]>(DEFAULT_DAYS);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading) {
      Promise.resolve().then(() => {
        const configs = toDayConfigs(openingHours);
        setDays(configs);
        setInitialDays(configs);
      });
    }
  }, [openingHours, loading]);

  function errorKey(dayIndex: number, periodIdx: number, field: string) {
    return `${dayIndex}-${periodIdx}-${field}`;
  }

  function toggleDay(dayIndex: number, value: boolean) {
    setDays(prev =>
      prev.map(d =>
        d.day_of_week === dayIndex ? { ...d, is_open: value } : d,
      ),
    );
  }

  function updatePeriod(
    dayIndex: number,
    periodIdx: number,
    field: "opens_at" | "closes_at",
    value: string,
  ) {
    setDays(prev =>
      prev.map(d => {
        if (d.day_of_week !== dayIndex) return d;
        const periods = d.periods.map((p, i) =>
          i === periodIdx ? { ...p, [field]: value } : p,
        );
        return { ...d, periods };
      }),
    );
    setErrors(prev => {
      const e = { ...prev };
      delete e[errorKey(dayIndex, periodIdx, field)];
      return e;
    });
  }

  function addPeriod(dayIndex: number) {
    setDays(prev =>
      prev.map(d => {
        if (d.day_of_week !== dayIndex) return d;
        return {
          ...d,
          periods: [...d.periods, { opens_at: "13:00", closes_at: "18:00" }],
        };
      }),
    );
  }

  function removePeriod(dayIndex: number, periodIdx: number) {
    setDays(prev =>
      prev.map(d => {
        if (d.day_of_week !== dayIndex) return d;
        return { ...d, periods: d.periods.filter((_, i) => i !== periodIdx) };
      }),
    );
  }

  function validateDays(days: DayConfig[]): boolean {
    const newErrors: Record<string, string> = {};

    for (const day of days) {
      if (!day.is_open) continue;

      for (let i = 0; i < day.periods.length; i++) {
        const period = day.periods[i];

        if (period.closes_at <= period.opens_at) {
          newErrors[errorKey(day.day_of_week, i, "opens_at")] =
            "Abertura deve ser menor que o fechamento.";
          newErrors[errorKey(day.day_of_week, i, "closes_at")] =
            "Fechamento deve ser maior que a abertura.";
        }

        if (i > 0) {
          const prev = day.periods[i - 1];
          if (period.opens_at <= prev.closes_at) {
            newErrors[errorKey(day.day_of_week, i, "opens_at")] =
              `Deve ser após o fechamento do período ${i}`;
            newErrors[errorKey(day.day_of_week, i, "closes_at")] =
              `Conflito com o período ${i}`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!barbershop?.id) return;

    const valid = validateDays(days);
    if (!valid) {
      toast.error("Corrija os horários destacados em vermelho.");
      return;
    }

    setSaving(true);
    const entries = toPeriodEntries(days, barbershop.id);
    const ok = await upsertOpeningHours(barbershop.id, entries);
    setSaving(false);

    if (!ok) {
      toast.error("Erro ao salvar horários.");
      return;
    }

    toast.success("Horários salvos!");
    setInitialDays(days);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDirty = JSON.stringify(days) !== JSON.stringify(initialDays);

  return (
    <section className="w-full max-w-180 px-3 md:px-16 mx-auto flex flex-col gap-6 mb-18">
      <div className="flex flex-col gap-1 px-3">
        <div className="flex flex-col w-fit mt-3">
          <h2 className="font-semibold text-2xl">Horário de funcionamento</h2>
          <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
        </div>
        <p className="text-sm text-muted-foreground">
          Configure os dias e horários que a barbearia está aberta. Você pode
          adicionar múltiplos períodos por dia.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {days.map(day => (
          <div
            key={day.day_of_week}
            className="flex flex-col gap-3 p-4 rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={day.is_open}
                onCheckedChange={v => toggleDay(day.day_of_week, v)}
                className="cursor-pointer"
              />
              <span className="text-sm font-medium">
                {DAY_LABELS[day.day_of_week]}
              </span>
            </div>
            {day.is_open ? (
              <>
                <p className="text-sm text-muted-foreground pl-3 flex gap-2 items-center">
                  <span className="inline-block rounded-full w-2 h-2 bg-green-600" />
                  Aberto
                </p>
                <div className="flex flex-col items-center gap-2">
                  {day.periods.map((period, idx) => (
                    <div
                      key={idx}
                      className={`w-full min-w-66 max-w-95 ml-6 flex items-start gap-2 relative ${day.periods.length > 1 ? "pr-14" : "pr-6"}`}
                    >
                      <div className="flex-1 flex flex-col gap-1">
                        <Select
                          value={period.opens_at}
                          onValueChange={v =>
                            updatePeriod(day.day_of_week, idx, "opens_at", v)
                          }
                        >
                          <SelectTrigger
                            className={`w-full ${errors[errorKey(day.day_of_week, idx, "opens_at")] ? "border-destructive" : ""}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors[errorKey(day.day_of_week, idx, "opens_at")] && (
                          <p className="text-xs text-center text-destructive">
                            {errors[errorKey(day.day_of_week, idx, "opens_at")]}
                          </p>
                        )}
                      </div>

                      <span className="text-sm text-muted-foreground shrink-0 mb-auto mt-2">
                        até
                      </span>

                      <div className="flex-1 flex flex-col gap-1">
                        <Select
                          value={period.closes_at}
                          onValueChange={v =>
                            updatePeriod(day.day_of_week, idx, "closes_at", v)
                          }
                        >
                          <SelectTrigger
                            className={`w-full ${errors[errorKey(day.day_of_week, idx, "closes_at")] ? "border-destructive" : ""}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map(t => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors[
                          errorKey(day.day_of_week, idx, "closes_at")
                        ] && (
                          <p className="text-xs text-center text-destructive">
                            {
                              errors[
                                errorKey(day.day_of_week, idx, "closes_at")
                              ]
                            }
                          </p>
                        )}
                      </div>

                      {day.periods.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive shrink-0 cursor-pointer absolute right-4"
                          onClick={() => removePeriod(day.day_of_week, idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground cursor-pointer"
                    onClick={() => addPeriod(day.day_of_week)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Período
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground pl-3 flex gap-2 items-center">
                <span className="inline-block rounded-full w-2 h-2 bg-red-600" />
                Fechado
              </p>
            )}
          </div>
        ))}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className="self-end cursor-pointer rounded-full mx-auto"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          "Salvar horários"
        )}
      </Button>
    </section>
  );
}
