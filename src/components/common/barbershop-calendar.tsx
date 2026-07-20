import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import type { OpeningHours } from "@/types/opening-hours";

interface BarbershopCalendarProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  openingHours: OpeningHours[];
}

export function BarbershopCalendar({
  selected,
  onSelect,
  openingHours,
}: BarbershopCalendarProps) {
  return (
    <div className="w-full max-w-3xs [&>div]:w-full [&_table]:w-full [&_thead_tr]:flex [&_thead_tr]:justify-between [&_tbody_tr]:flex [&_tbody_tr]:justify-between [&_th]:flex-1 [&_th]:text-center [&_td]:flex-1 [&_td]:text-center [&_td>button]:w-full mx-auto">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={onSelect}
        locale={ptBR}
        disabled={date => {
          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
          const isClosed = !openingHours.some(
            h => h.day_of_week === date.getDay() && h.is_open,
          );
          return isPast || isClosed;
        }}
        className="rounded-xl border border-border w-full p-3"
      />
    </div>
  );
}
