import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type {
  DayAvailability,
  DayPeriod,
} from "@/hooks/use-barber-availability";
import {
  DAY_LABELS,
  TIME_OPTIONS,
  errorKey,
} from "../../../utils/validate-availability.constants";

interface AvailabilitySectionProps {
  availability: DayAvailability[];
  onChange: (next: DayAvailability[]) => void;
  errors: Record<string, string>;
  onClearError?: (key: string) => void;
}

export function AvailabilitySection({
  availability,
  onChange,
  errors,
  onClearError,
}: AvailabilitySectionProps) {
  const [open, setOpen] = useState(() =>
    availability.some(d => d.use_custom_hours || d.is_day_off),
  );

  function updateDay(dayOfWeek: number, patch: Partial<DayAvailability>) {
    onChange(
      availability.map(d =>
        d.day_of_week === dayOfWeek ? { ...d, ...patch } : d,
      ),
    );
  }

  function updatePeriod(
    dayOfWeek: number,
    periodIdx: number,
    field: keyof DayPeriod,
    value: string,
  ) {
    onChange(
      availability.map(d => {
        if (d.day_of_week !== dayOfWeek) return d;
        return {
          ...d,
          periods: d.periods.map((p, i) =>
            i === periodIdx ? { ...p, [field]: value } : p,
          ),
        };
      }),
    );
    onClearError?.(errorKey(dayOfWeek, periodIdx, field));
  }

  function addPeriod(dayOfWeek: number) {
    onChange(
      availability.map(d => {
        if (d.day_of_week !== dayOfWeek) return d;
        return {
          ...d,
          periods: [...d.periods, { starts_at: "13:00", ends_at: "18:00" }],
        };
      }),
    );
  }

  function removePeriod(dayOfWeek: number, periodIdx: number) {
    onChange(
      availability.map(d => {
        if (d.day_of_week !== dayOfWeek) return d;
        return {
          ...d,
          periods: d.periods.filter((_, i) => i !== periodIdx),
        };
      }),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Botão collapsible */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <span>Personalizar horários e folga</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Conteúdo expansível */}
      {open && (
        <div className="flex flex-col gap-2">
          {availability.map(day => (
            <div
              key={day.day_of_week}
              className="flex flex-col gap-3 p-3 rounded-lg border"
            >
              {/* Linha: nome + toggles */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium w-8">
                  {DAY_LABELS[day.day_of_week]}
                </span>
                <div className="flex items-center gap-4">
                  {!day.is_day_off && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        Personalizado
                      </span>
                      <Switch
                        className="cursor-pointer"
                        checked={day.use_custom_hours}
                        onCheckedChange={checked =>
                          updateDay(day.day_of_week, {
                            use_custom_hours: checked,
                            periods: checked
                              ? [{ starts_at: "08:00", ends_at: "18:00" }]
                              : day.periods,
                          })
                        }
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Folga</span>
                    <Switch
                      className="cursor-pointer"
                      checked={day.is_day_off}
                      onCheckedChange={checked =>
                        updateDay(day.day_of_week, {
                          is_day_off: checked,
                          use_custom_hours: checked
                            ? false
                            : day.use_custom_hours,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Horário integral */}
              {!day.is_day_off && !day.use_custom_hours && (
                <p className="text-xs text-muted-foreground pl-1 flex gap-2 items-center">
                  <span className="inline-block rounded-full w-2 h-2 bg-green-600" />
                  Horário integral da barbearia
                </p>
              )}

              {/* Folga */}
              {day.is_day_off && (
                <p className="text-xs text-muted-foreground pl-1 flex gap-2 items-center">
                  <span className="inline-block rounded-full w-2 h-2 bg-red-600" />
                  Folga
                </p>
              )}

              {/* Períodos personalizados */}
              {!day.is_day_off && day.use_custom_hours && (
                <div className="flex flex-col items-center gap-2">
                  {day.periods.map((period, idx) => (
                    <div
                      key={idx}
                      className={`w-full flex items-start gap-2 relative ${
                        day.periods.length > 1 ? "pr-10" : ""
                      }`}
                    >
                      {/* Início */}
                      <div className="flex-1 flex flex-col gap-1">
                        <Select
                          value={period.starts_at}
                          onValueChange={v =>
                            updatePeriod(day.day_of_week, idx, "starts_at", v)
                          }
                        >
                          <SelectTrigger
                            className={`w-full ${
                              errors[
                                errorKey(day.day_of_week, idx, "starts_at")
                              ]
                                ? "border-destructive"
                                : ""
                            }`}
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
                          errorKey(day.day_of_week, idx, "starts_at")
                        ] && (
                          <p className="text-xs text-center text-destructive">
                            {
                              errors[
                                errorKey(day.day_of_week, idx, "starts_at")
                              ]
                            }
                          </p>
                        )}
                      </div>

                      <span className="text-sm text-muted-foreground shrink-0 mb-auto mt-2">
                        até
                      </span>

                      {/* Fim */}
                      <div className="flex-1 flex flex-col gap-1">
                        <Select
                          value={period.ends_at}
                          onValueChange={v =>
                            updatePeriod(day.day_of_week, idx, "ends_at", v)
                          }
                        >
                          <SelectTrigger
                            className={`w-full ${
                              errors[errorKey(day.day_of_week, idx, "ends_at")]
                                ? "border-destructive"
                                : ""
                            }`}
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
                        {errors[errorKey(day.day_of_week, idx, "ends_at")] && (
                          <p className="text-xs text-center text-destructive">
                            {errors[errorKey(day.day_of_week, idx, "ends_at")]}
                          </p>
                        )}
                      </div>

                      {/* Remover período */}
                      {day.periods.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive shrink-0 cursor-pointer absolute right-0"
                          onClick={() => removePeriod(day.day_of_week, idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Adicionar período */}
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
