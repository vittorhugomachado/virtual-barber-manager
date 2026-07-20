import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import type { OpeningHours } from "@/types/opening-hours";
import { useMemo } from "react";

interface BarbershopCalendarProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  openingHours: OpeningHours[];
  timezone: string;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey(timezone: string) {
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

export function BarbershopCalendar({
  selected,
  onSelect,
  openingHours,
  timezone,
}: BarbershopCalendarProps) {
  const openWeekdays = useMemo(
    () =>
      new Set(
        openingHours.filter(item => item.is_open).map(item => item.day_of_week),
      ),
    [openingHours],
  );
  const shopToday = todayKey(timezone);

  return (
    <div className="w-full max-w-3xs [&>div]:w-full [&_table]:w-full [&_thead_tr]:flex [&_thead_tr]:justify-between [&_tbody_tr]:flex [&_tbody_tr]:justify-between [&_th]:flex-1 [&_th]:text-center [&_td]:flex-1 [&_td]:text-center [&_td>button]:w-full mx-auto">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={onSelect}
        locale={ptBR}
        disabled={date => {
          const isPast = dateKey(date) < shopToday;
          const isClosed = !openWeekdays.has(date.getDay());
          return isPast || isClosed;
        }}
        className="rounded-xl border border-border w-full p-3"
      />
    </div>
  );
}
