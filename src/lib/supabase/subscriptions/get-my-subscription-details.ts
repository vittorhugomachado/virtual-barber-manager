import { supabase } from "@/lib/supabase/supabase";
import type { SubscriptionStatus } from "./get-my-subscription";

export type MySubscriptionPlan = {
  name: string;
  description: string | null;
  price_cents: number;
  asaas_cycle: string;
};

export type MySubscriptionDetails = {
  id: string;
  status: SubscriptionStatus;
  plan_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  grace_period_days: number;
  created_at: string;
  asaas_subscription_id: string | null;
  plan: MySubscriptionPlan | null;
};

// Busca a assinatura da barbearia do usuário logado, já com o plano (join).
// A RLS (subscriptions_select_owner) restringe ao dono, então o select sem
// filtro traz no máximo a assinatura dele. Retorna null se não houver.
export async function getMySubscriptionDetails(): Promise<{
  data: MySubscriptionDetails | null;
  error: string | null;
}> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { data: null, error: null };

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, status, plan_id, trial_ends_at, current_period_end, canceled_at, grace_period_days, created_at, asaas_subscription_id, plan:plan_id ( name, description, price_cents, asaas_cycle )",
    )
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  // O join pode vir como objeto (1:1) ou array, dependendo da inferência do
  // supabase-js. Normaliza para objeto único.
  const row = data as Record<string, unknown> & { plan?: unknown };
  const plan = Array.isArray(row.plan)
    ? (row.plan[0] ?? null)
    : (row.plan ?? null);

  return {
    data: { ...(row as unknown as MySubscriptionDetails), plan },
    error: null,
  };
}
