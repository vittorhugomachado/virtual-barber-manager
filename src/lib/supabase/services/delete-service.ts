import { supabase } from "../supabase";

export async function deleteService(id: string): Promise<boolean> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  return !error;
}
