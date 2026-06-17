import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { HeaderPage } from "@/components/common/header-page";
import { BuyPlanMain } from "@/components/main/buy-plan";
import { Spinner } from "@/components/ui/spinner";
import { getMySubscription } from "@/lib/supabase/subscriptions/get-my-subscription";

export function BuyPlanPage() {
  const [checking, setChecking] = useState(true);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await getMySubscription();
      if (!mounted) return;
      // Já assinou (tem assinatura no Asaas) -> manda para "minha assinatura",
      // onde ficam renovar/cancelar. A página /assinar é só para a 1ª compra.
      setAlreadySubscribed(Boolean(data?.asaas_subscription_id));
      setChecking(false);
    }

    void check();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (alreadySubscribed) {
    return <Navigate to="/minha-assinatura" replace />;
  }

  return (
    <div className="flex w-full min-h-screen flex-col gap-6">
      <HeaderPage page="Assinar" />
      <BuyPlanMain />
    </div>
  );
}
