import { supabase } from "@/lib/supabase/supabase";

export type SubscriptionStatus =
  | "trialing"
  | "incomplete"
  | "active"
  | "past_due"
  | "canceled";

export type MySubscription = {
  id: string;
  status: SubscriptionStatus;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  current_period_end: string | null;
};

// Retorna a assinatura da barbearia do usuário logado.
// A RLS (subscriptions_select_owner) já restringe ao dono, então o select sem
// filtro traz no máximo a assinatura dele. Retorna null se não houver usuário
// ou assinatura.
export async function getMySubscription(): Promise<{
  data: MySubscription | null;
  error: string | null;
}> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, status, asaas_customer_id, asaas_subscription_id, current_period_end",
    )
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data as MySubscription | null) ?? null, error: null };
}
