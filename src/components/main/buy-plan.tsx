import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  QrCode,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPlans } from "@/lib/supabase/plans/get-plans";
import type { Plan } from "@/lib/supabase/plans/types";
import { supabase } from "@/lib/supabase/supabase";
import { cn } from "@/lib/utils";
import { isValidCpfCnpj } from "@/utils/validate-cpf-cnpj";

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

const CYCLE_MONTHS: Record<string, number> = {
  WEEKLY: 0,
  BIWEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};
const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
};
const CYCLE_SUFFIX: Record<string, string> = {
  MONTHLY: "/mês",
  QUARTERLY: "/trimestre",
  SEMIANNUALLY: "/semestre",
  YEARLY: "/ano",
};

const billingOptions: Array<{
  type: BillingType;
  label: string;
  icon: typeof QrCode;
}> = [
  { type: "PIX", label: "Pix", icon: QrCode },
  { type: "BOLETO", label: "Boleto", icon: ReceiptText },
  { type: "CREDIT_CARD", label: "Cartão", icon: CreditCard },
];

// Mensagens amigáveis para os códigos de erro da create-subscription.
const ERROR_MESSAGES: Record<string, string> = {
  subscription_already_exists: "Você já possui uma assinatura.",
  provisioning_in_progress:
    "Já estamos processando sua assinatura. Aguarde um instante.",
  invalid_cpf_cnpj: "CPF ou CNPJ inválido.",
  missing_cpf_cnpj: "Informe o CPF ou CNPJ.",
  rate_limited: "Muitas tentativas. Aguarde um instante e tente de novo.",
  not_barbershop_owner: "Apenas o proprietário pode assinar.",
  invalid_or_inactive_plan: "Plano indisponível. Recarregue a página.",
  internal_error: "Erro interno. Tente novamente mais tarde.",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
const cycleLabel = (cycle: string) => CYCLE_LABEL[cycle] ?? cycle;
const cycleSuffix = (cycle: string) => CYCLE_SUFFIX[cycle] ?? "/ciclo";
function monthlyEquivalentCents(plan: Plan) {
  const months = CYCLE_MONTHS[plan.asaas_cycle] || 1;
  return Math.round(plan.price_cents / months);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido";
}

type InvokeErrorWithContext = {
  context?: { json?: () => Promise<unknown> };
};

function friendlyErrorFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { error?: string; message?: string };
  if (b.error && ERROR_MESSAGES[b.error]) return ERROR_MESSAGES[b.error];
  if (typeof b.message === "string") return b.message;
  if (typeof b.error === "string") return b.error;
  return null;
}

export function BuyPlanMain() {
  const [step, setStep] = useState<1 | 2>(1);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [barbershopId, setBarbershopId] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const [plansRes, userRes] = await Promise.all([
        getPlans(),
        supabase.auth.getUser(),
      ]);
      if (!mounted) return;

      if (plansRes.error) {
        setPlans([]);
        setPlansError(
          "Não foi possível carregar os planos. Recarregue a página e tente novamente.",
        );
      } else if (plansRes.data?.length) {
        setPlans(plansRes.data);
        setPlansError(null);
      } else {
        setPlans([]);
        setPlansError("Nenhum plano disponível no momento.");
      }
      setLoadingPlans(false);

      const userId = userRes.data.user?.id;
      if (userId) {
        const { data: shop } = await supabase
          .from("barbershops")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();
        if (!mounted) return;
        if (shop) setBarbershopId(shop.id);
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // "Melhor valor" = menor preço por mês — calculado dos dados, sem hardcode.
  const bestValuePlanId = useMemo(() => {
    if (plans.length < 2) return null;
    return plans.reduce((best, p) =>
      monthlyEquivalentCents(p) < monthlyEquivalentCents(best) ? p : best,
    ).id;
  }, [plans]);

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  function choosePlan(id: string) {
    setSelectedPlanId(id);
    setError(null);
    setDone(false);
    setStep(2);
  }

  async function handleSubscribe() {
    if (!selectedPlan || submitting) return;
    if (!barbershopId) {
      setError("Nenhuma barbearia encontrada para o usuário logado.");
      return;
    }
    if (!cpfCnpj.trim()) {
      setError("Informe o CPF ou CNPJ.");
      return;
    }
    if (!isValidCpfCnpj(cpfCnpj)) {
      setError("CPF ou CNPJ inválido.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setDone(false);
    setInvoiceUrl(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "create-subscription",
        {
          body: {
            barbershop_id: barbershopId,
            plan_id: selectedPlan.id,
            billing_type: billingType,
            cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
            mobile_phone: mobilePhone.replace(/\D/g, "") || undefined,
          },
        },
      );

      if (invokeError) {
        const body = await (invokeError as InvokeErrorWithContext).context
          ?.json?.()
          .catch(() => null);
        setError(friendlyErrorFromBody(body) ?? getErrorMessage(invokeError));
        return;
      }

      const url = (data as { invoice_url?: string | null })?.invoice_url ?? null;
      setInvoiceUrl(url);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 text-sm">
          <StepPill n={1} label="Plano" active={step === 1} done={step > 1} />
          <div className="h-px w-10 bg-zinc-300 dark:bg-zinc-700" />
          <StepPill n={2} label="Pagamento" active={step === 2} done={false} />
        </div>

        {step === 1 && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-semibold">Escolha seu plano</h1>
              <p className="text-sm text-zinc-500">
                Selecione o ciclo que faz mais sentido para a sua barbearia.
              </p>
            </div>

            {loadingPlans ? (
              <p className="text-center text-sm text-zinc-500">
                Carregando planos…
              </p>
            ) : plansError ? (
              <p className="mx-auto max-w-md rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {plansError}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map(plan => {
                  const best = plan.id === bestValuePlanId;
                  const months = CYCLE_MONTHS[plan.asaas_cycle] || 1;
                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        "relative flex flex-col rounded-2xl border bg-white p-6 transition dark:bg-zinc-900",
                        best
                          ? "border-blue-500 ring-1 ring-blue-500/30"
                          : "border-zinc-200 dark:border-zinc-800",
                      )}
                    >
                      {best && (
                        <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Melhor valor
                        </span>
                      )}

                      <h3 className="text-lg font-semibold">
                        {cycleLabel(plan.asaas_cycle)}
                      </h3>

                      <div className="mt-3 flex items-end gap-1">
                        <span className="text-3xl font-bold">
                          {formatMoney(plan.price_cents)}
                        </span>
                        <span className="mb-1 text-sm text-zinc-500">
                          {cycleSuffix(plan.asaas_cycle)}
                        </span>
                      </div>

                      {months > 1 && (
                        <p className="mt-1 text-xs text-zinc-500">
                          equivale a {formatMoney(monthlyEquivalentCents(plan))}
                          /mês
                        </p>
                      )}

                      {plan.description && (
                        <p className="mt-4 text-sm text-zinc-500">
                          {plan.description}
                        </p>
                      )}

                      <Button
                        type="button"
                        size="lg"
                        variant={best ? "default" : "outline"}
                        onClick={() => choosePlan(plan.id)}
                        className="mt-6 w-full"
                      >
                        Escolher {cycleLabel(plan.asaas_cycle)}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {step === 2 && selectedPlan && (
          <section className="mx-auto flex w-full max-w-lg flex-col gap-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 self-start text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <ArrowLeft className="size-4" />
              Voltar aos planos
            </button>

            {/* Resumo do plano escolhido */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">Plano selecionado</p>
                <p className="truncate font-semibold">{selectedPlan.name}</p>
              </div>
              <p className="shrink-0 text-xl font-bold">
                {formatMoney(selectedPlan.price_cents)}
                <span className="text-sm font-normal text-zinc-500">
                  {cycleSuffix(selectedPlan.asaas_cycle)}
                </span>
              </p>
            </div>

            {/* Método de pagamento */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Método de pagamento</Label>
              <div className="grid grid-cols-3 gap-3">
                {billingOptions.map(option => {
                  const Icon = option.icon;
                  const active = billingType === option.type;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => setBillingType(option.type)}
                      className={cn(
                        "flex h-20 flex-col items-center justify-center gap-1.5 rounded-lg border bg-white text-sm font-medium transition dark:bg-zinc-900",
                        active
                          ? "border-blue-600 text-blue-600 ring-2 ring-blue-600/20"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                      )}
                    >
                      <Icon className="size-5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {billingType === "CREDIT_CARD" && (
                <p className="text-xs text-zinc-500">
                  Os dados do cartão são preenchidos com segurança na página do
                  Asaas — nunca passam por aqui.
                </p>
              )}
            </div>

            {/* CPF / CNPJ */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpf-cnpj" className="text-sm font-medium">
                CPF / CNPJ <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cpf-cnpj"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={e =>
                  setCpfCnpj(e.target.value.replace(/\D/g, "").slice(0, 14))
                }
              />
            </div>

            {/* Celular */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mobile-phone" className="text-sm font-medium">
                Celular (opcional)
              </Label>
              <Input
                id="mobile-phone"
                placeholder="(11) 99999-9999"
                value={mobilePhone}
                onChange={e => setMobilePhone(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            {done ? (
              invoiceUrl ? (
                <Button asChild size="lg">
                  <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Ir para o pagamento
                  </a>
                </Button>
              ) : (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Assinatura criada! Estamos preparando sua fatura — isso leva
                  alguns segundos.
                </p>
              )
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={handleSubscribe}
                disabled={submitting || !barbershopId || !cpfCnpj.trim()}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? "Processando..." : "Assinar"}
              </Button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function StepPill({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
          active || done
            ? "bg-blue-600 text-white"
            : "bg-zinc-300 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
        )}
      >
        {n}
      </span>
      <span
        className={cn(
          "text-sm",
          active ? "font-semibold" : "text-zinc-500",
        )}
      >
        {label}
      </span>
    </div>
  );
}
