import { supabase } from "@/lib/supabase/supabase";

export async function getPlans() {
  return supabase
    .from("plans")
    .select("id, code, name, description, price_cents, asaas_cycle, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
}
