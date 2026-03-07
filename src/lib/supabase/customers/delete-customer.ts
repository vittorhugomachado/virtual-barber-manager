import { supabase } from "../supabase";

export async function deleteCustomer(id: string): Promise<boolean> {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  return !error;
}
