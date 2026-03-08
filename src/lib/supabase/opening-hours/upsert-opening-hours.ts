import { supabase } from "../supabase";
import type { OpeningHours } from "@/types/opening-hours";

export async function upsertOpeningHours(
  barbershopId: string,
  hours: Omit<OpeningHours, "id">[],
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("opening_hours")
    .delete()
    .eq("barbershop_id", barbershopId);

  if (deleteError) return false;

  if (hours.length === 0) return true;

  const { error } = await supabase
    .from("opening_hours")
    .insert(hours.map(h => ({ ...h, barbershop_id: barbershopId })));

  if (error) {
    console.error("insert error:", error);
    return false;
  }

  return true;
}
