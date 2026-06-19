import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Hourglass,
  Receipt,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  getMySubscriptionDetails,
  type MySubscriptionDetails,
} from "@/lib/supabase/subscriptions/get-my-subscription-details";
import type { SubscriptionStatus } from "@/lib/supabase/subscriptions/get-my-subscription";

const CYCLE_LABEL: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
};

const CYCLE_SUFFIX: Record<string, string> = {
  WEEKLY: "/semana",
  BIWEEKLY: "/quinzena",
  MONTHLY: "/mes",
  QUARTERLY: "/trimestre",
  SEMIANNUALLY: "/semestre",
  YEARLY: "/ano",
};

type Tone = "green" | "blue" | "amber" | "red" | "zinc";

type StatusMeta = {
  label: string;
  tone: Tone;
  icon: typeof CheckCircle2;
  description: string;
};

const STATUS_META: Record<SubscriptionStatus, StatusMeta> = {
  active: {
    label: "Em dia",
    tone: "green",
    icon: CheckCircle2,
    description: "Sua assinatura está ativa e os pagamentos em dia.",
  },
  trialing: {
    label: "Período de teste",
    tone: "blue",
    icon: Hourglass,
    description: "Você está no período de teste gratuito.",
  },
  incomplete: {
    label: "Pagamento pendente",
    tone: "amber",
    icon: Clock,
    description: "Estamos aguardando a confirmação do seu pagamento.",
  },
  past_due: {
    label: "Pagamento atrasado",
    tone: "red",
    icon: AlertTriangle,
    description:
      "Não recebemos o último pagamento. Regularize para não perder o acesso.",
  },
  canceled: {
    label: "Cancelada",
    tone: "zinc",
    icon: XCircle,
    description: "Sua assinatura foi cancelada.",
  },
};

const TONE_BANNER: Record<Tone, string> = {
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
};

const TONE_ICON: Record<Tone, string> = {
  green: "bg-emerald-600",
  blue: "bg-blue-600",
  amber: "bg-amber-500",
  red: "bg-red-600",
  zinc: "bg-zinc-500",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function cycleLabel(cycle: string | undefined) {
  return cycle ? (CYCLE_LABEL[cycle] ?? cycle) : "—";
}

function cycleSuffix(cycle: string | undefined) {
  return cycle ? (CYCLE_SUFFIX[cycle] ?? "/ciclo") : "";
}

// Dias inteiros a partir de hoje até a data (negativo = já passou).
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function remainingLabel(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return `expirou há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "expira hoje";
  if (days === 1) return "falta 1 dia";
  return `faltam ${days} dias`;
}

function InfoCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <Icon className="size-4" />
        {label}
      </div>
      <span className="text-lg font-semibold">{value}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}

export function MySignatureMain() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] =
    useState<MySubscriptionDetails | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error: fetchError } = await getMySubscriptionDetails();
      if (!mounted) return;
      if (fetchError) setError(fetchError);
      else setSubscription(data);
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-9" />
      </div>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Não foi possível carregar sua assinatura. Recarregue a página e tente
          novamente.
        </div>
      </main>
    );
  }

  if (!subscription) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold">
            Nenhuma assinatura encontrada
          </h1>
          <p className="max-w-md text-sm text-zinc-500">
            Você ainda não tem uma assinatura ativa para esta barbearia.
          </p>
          <Button asChild size="lg">
            <Link to="/assinatura">Escolher um plano</Link>
          </Button>
        </div>
      </main>
    );
  }

  const meta = STATUS_META[subscription.status];
  const StatusIcon = meta.icon;
  const plan = subscription.plan;

  const isActive = subscription.status === "active";
  const isTrial = subscription.status === "trialing";
  const isPastDue = subscription.status === "past_due";
  const isIncomplete = subscription.status === "incomplete";
  const isCanceled = subscription.status === "canceled";

  // Data de referência da validade: assinatura paga usa current_period_end;
  // no teste, usa trial_ends_at.
  const validUntil = isTrial
    ? subscription.trial_ends_at
    : subscription.current_period_end;
  const validUntilDays = daysUntil(validUntil);

  // Carência: só faz sentido em atraso, a partir do fim do período pago.
  const graceEnd =
    isPastDue && subscription.current_period_end
      ? addDays(subscription.current_period_end, subscription.grace_period_days)
      : null;
  const graceDays = daysUntil(graceEnd);

  const showSubscribeCta = isTrial || isIncomplete || isCanceled || isPastDue;
  const ctaLabel = isPastDue
    ? "Regularizar pagamento"
    : isIncomplete
      ? "Concluir pagamento"
      : "Assinar agora";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 text-zinc-950 dark:text-zinc-50">
      <div>
        <h1 className="text-2xl font-semibold">Minha assinatura</h1>
        <p className="text-sm text-zinc-500">
          Acompanhe o status do seu plano e a data de validade.
        </p>
      </div>

      {/* Banner de status — responde à pergunta "está em dia?" */}
      <div
        className={cn(
          "flex items-start gap-4 rounded-2xl border p-5",
          TONE_BANNER[meta.tone],
        )}
      >
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-white",
            TONE_ICON[meta.tone],
          )}
        >
          <StatusIcon className="size-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold">{meta.label}</span>
          <span className="text-sm opacity-90">{meta.description}</span>

          {isPastDue && graceEnd && (
            <span className="mt-1 text-sm font-medium">
              Carência até {formatDate(graceEnd)}
              {graceDays !== null &&
                graceDays >= 0 &&
                ` (${remainingLabel(graceDays)})`}
              .
            </span>
          )}
        </div>
      </div>

      {/* Cartões com os dados principais */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard
          icon={Receipt}
          label="Plano"
          value={plan?.name ?? (isTrial ? "Teste gratuito" : "—")}
          hint={plan ? cycleLabel(plan.asaas_cycle) : undefined}
        />
        <InfoCard
          icon={CreditCard}
          label="Valor"
          value={plan ? formatMoney(plan.price_cents) : "—"}
          hint={plan ? `cobrado ${cycleSuffix(plan.asaas_cycle)}` : undefined}
        />
        <InfoCard
          icon={CalendarClock}
          label={isTrial ? "Teste válido até" : "Plano válido até"}
          value={formatDate(validUntil)}
          hint={validUntil ? remainingLabel(validUntilDays) : undefined}
        />
        <InfoCard
          icon={Clock}
          label={isActive ? "Próxima renovação" : "Situação"}
          value={
            isActive ? formatDate(subscription.current_period_end) : meta.label
          }
          hint={
            isCanceled && subscription.canceled_at
              ? `cancelada em ${formatDate(subscription.canceled_at)}`
              : undefined
          }
        />
      </div>

      {/* Detalhes adicionais */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Detalhes</h2>
        <dl className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-zinc-500">Cliente desde</dt>
            <dd className="font-medium">
              {formatDate(subscription.created_at)}
            </dd>
          </div>
          {plan?.description && (
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-zinc-500">Descrição</dt>
              <dd className="max-w-[60%] text-right font-medium">
                {plan.description}
              </dd>
            </div>
          )}
          {subscription.asaas_subscription_id && (
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-zinc-500">Código da assinatura</dt>
              <dd className="font-mono text-xs">
                {subscription.asaas_subscription_id}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {showSubscribeCta && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">
            {isTrial
              ? "Garanta a continuidade do acesso assinando um plano."
              : "Resolva a pendência para manter sua barbearia ativa."}
          </p>
          <Button asChild size="lg">
            <Link to="/assinatura">{ctaLabel}</Link>
          </Button>
        </div>
      )}
    </main>
  );
}
