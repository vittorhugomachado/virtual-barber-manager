import { supabase } from "../supabase";
import type { OpeningHours } from "@/types/opening-hours";
import {
  deleteSettingsCache,
  setSettingsCache,
  settingsCacheKey,
} from "@/lib/settings-cache";

export async function upsertOpeningHours(
  barbershopId: string,
  hours: Omit<OpeningHours, "id">[],
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("opening_hours")
    .delete()
    .eq("barbershop_id", barbershopId);

  if (deleteError) return false;

  if (hours.length === 0) {
    setSettingsCache<OpeningHours[]>(
      settingsCacheKey(barbershopId, "opening-hours"),
      [],
    );
    return true;
  }

  const { data, error } = await supabase
    .from("opening_hours")
    .insert(hours.map(h => ({ ...h, barbershop_id: barbershopId })))
    .select("*");

  if (error) {
    deleteSettingsCache(settingsCacheKey(barbershopId, "opening-hours"));
    console.error("insert error:", error);
    return false;
  }

  setSettingsCache<OpeningHours[]>(
    settingsCacheKey(barbershopId, "opening-hours"),
    (data ?? []) as OpeningHours[],
  );

  return true;
}
