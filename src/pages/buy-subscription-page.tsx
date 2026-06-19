import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { HeaderPage } from "@/components/common/header-page";
import { BuySubscriptionMain } from "@/components/main/buy-subscription-main";
import { PendingPaymentCard } from "@/components/main/pending-payment-card";
import { Spinner } from "@/components/ui/spinner";
import { getMySubscription } from "@/lib/supabase/subscriptions/get-my-subscription";

export function BuySubscriptionPage() {
  const [checking, setChecking] = useState(true);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [pendingTimedOut, setPendingTimedOut] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Checagem inicial: define se vai pra "minha assinatura", se mostra o
  // "processando" (cobrança pendente) ou se vai direto pra escolha de plano.
  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await getMySubscription();
      if (!mounted) return;
      if (data?.asaas_subscription_id && data?.status === "active") {
        setAlreadySubscribed(true);
      } else if (
        data?.asaas_subscription_id &&
        (data?.status === "trialing" || data?.status === "incomplete")
      ) {
        setHasPendingPayment(true);
      }
      setChecking(false);
    }
    void check();

    return () => {
      mounted = false;
    };
  }, []);

  // Enquanto há cobrança pendente, faz polling por ~2 min aguardando a
  // confirmação. Se confirmar -> "minha assinatura". Se estourar -> timeout.
  useEffect(() => {
    if (!hasPendingPayment || pendingTimedOut || restarting) return;

    let mounted = true;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      const { data } = await getMySubscription();
      if (!mounted) return;

      if (data?.status === "active") {
        setAlreadySubscribed(true);
        return;
      }
      if (attempts >= 40) {
        setPendingTimedOut(true);
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 3000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [hasPendingPayment, pendingTimedOut, restarting]);

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

  const showPending = hasPendingPayment && !restarting;

  return (
    <div className="flex w-full min-h-screen flex-col gap-6">
      <HeaderPage page="Assinar" />
      {showPending ? (
        <PendingPaymentCard
          timedOut={pendingTimedOut}
          onRestart={() => setRestarting(true)}
        />
      ) : (
        <BuySubscriptionMain />
      )}
    </div>
  );
}
