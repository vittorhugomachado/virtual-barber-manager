import { supabase } from "@/lib/supabase/supabase";
import type { Plan } from "@/lib/supabase/plans/types";

// Busca os planos ATIVOS do banco, ordenados por sort_order.
// Retorna o shape padrão do Supabase ({ data, error }) já tipado como Plan[],
// então o consumidor não precisa de cast.
export async function getPlans() {
  return supabase
    .from("plans")
    .select("id, code, name, description, price_cents, asaas_cycle, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<Plan[]>();
}
