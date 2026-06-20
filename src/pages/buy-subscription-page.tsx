import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { HeaderPage } from "@/components/common/header-page";
import { BuySubscriptionMain } from "@/components/main/buy-subscription-main";
import { Spinner } from "@/components/ui/spinner";
import { getMySubscription } from "@/lib/supabase/subscriptions/get-my-subscription";

export function BuySubscriptionPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await getMySubscription();
      if (!mounted) return;

      const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000);
      const periodEnd = data?.current_period_end
        ? new Date(data.current_period_end)
        : null;
      const canRenew = !periodEnd || periodEnd <= sevenDaysFromNow;

      // Mensalista recorrente (tem asaas_subscription_id) pode acessar a página
      // a qualquer momento para trocar por um pacote. Só o assinante sem
      // recorrência (pacote) é redirecionado quando ainda tem +7 dias.
      const hasMonthlyRecurring = !!data?.asaas_subscription_id;

      if (data?.status === "active" && !canRenew && !hasMonthlyRecurring) {
        void navigate("/minha-assinatura", { replace: true });
        return;
      }

      setChecking(false);
    }
    void check();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-10" />
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen flex-col gap-6">
      <HeaderPage page="Assinar" />
      <BuySubscriptionMain />
    </div>
  );
}
