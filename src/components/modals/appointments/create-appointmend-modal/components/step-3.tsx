import { CalendarDays, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarbershopCalendar } from "@/components/common/barbershop-calendar";
import type { OpeningHours } from "@/types/opening-hours";

export function Step3Date({
  onBack,
  onSelect,
  openingHours,
  timezone,
}: {
  onBack: () => void;
  onSelect: (date: string, dateObj: Date) => void;
  openingHours: OpeningHours[];
  timezone: string;
}) {
  const [selectedDateObj, setSelectedDateObj] = useState<Date | undefined>(
    undefined,
  );

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    setSelectedDateObj(date);
  }

  function handleContinue() {
    if (!selectedDateObj) return;
    const iso = `${selectedDateObj.getFullYear()}-${String(
      selectedDateObj.getMonth() + 1,
    ).padStart(2, "0")}-${String(selectedDateObj.getDate()).padStart(2, "0")}`;
    onSelect(iso, selectedDateObj);
  }

  //CONSOLE PARA DEBUG
  // console.log("compoenente step 3 ", {
  //   openingHours,
  //   selectedDateObj,
  // });

  return (
    <div className="flex flex-col gap-5 px-2 py-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-md font-medium text-muted-foreground ml-4">
          <CalendarDays className="h-3.5 w-3.5" />
          Data
        </label>
        <BarbershopCalendar
          selected={selectedDateObj}
          onSelect={handleDateSelect}
          openingHours={openingHours}
          timezone={timezone}
        />
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selectedDateObj}
        className="cursor-pointer w-full rounded-full"
      >
        Continuar
      </Button>
    </div>
  );
}
