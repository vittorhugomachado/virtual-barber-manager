import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { OpeningHours } from "@/types/opening-hours";
import {
  getSettingsCache,
  loadSettingsCache,
  settingsCacheKey,
} from "@/lib/settings-cache";

export function useOpeningHours() {
  const { barbershop } = useBarbershopStore();
  const cacheKey = barbershop?.id
    ? settingsCacheKey(barbershop.id, "opening-hours")
    : null;
  const cachedHours = cacheKey
    ? getSettingsCache<OpeningHours[]>(cacheKey)
    : undefined;
  const [openingHours, setOpeningHours] = useState<OpeningHours[]>(
    () => cachedHours ?? [],
  );
  const [loading, setLoading] = useState(cachedHours === undefined);

  useEffect(() => {
    const barbershopId = barbershop?.id;
    if (!barbershopId) return;
    let mounted = true;

    const key = settingsCacheKey(barbershopId, "opening-hours");

    async function loadOpeningHours() {
      try {
        const data = await loadSettingsCache<OpeningHours[]>(key, async () => {
          const { data, error } = await supabase
            .from("opening_hours")
            .select("*")
            .eq("barbershop_id", barbershopId)
            .order("day_of_week");
          if (error) throw error;
          return (data ?? []) as OpeningHours[];
        });
        if (mounted) setOpeningHours(data);
      } catch {
        if (mounted) setOpeningHours([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadOpeningHours();

    return () => {
      mounted = false;
    };
  }, [barbershop?.id]);

  return { openingHours, setOpeningHours, loading };
}
