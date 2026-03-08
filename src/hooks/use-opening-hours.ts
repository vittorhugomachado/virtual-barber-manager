import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { OpeningHours } from "@/types/opening-hours";

export function useOpeningHours() {
  const { barbershop } = useBarbershopStore();
  const [openingHours, setOpeningHours] = useState<OpeningHours[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barbershop?.id) return;

    supabase
      .from("opening_hours")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("day_of_week")
      .then(({ data }) => {
        if (data) setOpeningHours(data);
        setLoading(false);
      });
  }, [barbershop?.id]);

  return { openingHours, setOpeningHours, loading };
}
