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
import { getMySubscription } from "@/lib/supabase/subscriptions/get-my-subscription";

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";
type PaymentState = "idle" | "processing" | "confirmed";
type BillingAddress = {
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

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
  MONTHLY: "/mes",
  QUARTERLY: "/trimestre",
  SEMIANNUALLY: "/semestre",
  YEARLY: "/ano",
};

const billingOptions: Array<{
  type: BillingType;
  label: string;
  icon: typeof QrCode;
}> = [
  { type: "CREDIT_CARD", label: "Cartao", icon: CreditCard },
  { type: "PIX", label: "Pix", icon: QrCode },
  { type: "BOLETO", label: "Boleto", icon: ReceiptText },
];

const ERROR_MESSAGES: Record<string, string> = {
  subscription_already_exists: "Voce ja possui uma assinatura.",
  provisioning_in_progress:
    "Ja estamos processando sua assinatura. Aguarde um instante.",
  invalid_cpf_cnpj: "CPF ou CNPJ invalido.",
  missing_cpf_cnpj: "Informe o CPF ou CNPJ.",
  rate_limited: "Muitas tentativas. Aguarde um instante e tente de novo.",
  not_barbershop_owner: "Apenas o proprietario pode assinar.",
  invalid_or_inactive_plan: "Plano indisponivel. Recarregue a pagina.",
  internal_error: "Erro interno. Tente novamente mais tarde.",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function cycleLabel(cycle: string) {
  return CYCLE_LABEL[cycle] ?? cycle;
}

function cycleSuffix(cycle: string) {
  return CYCLE_SUFFIX[cycle] ?? "/ciclo";
}

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
  const [billingType, setBillingType] = useState<BillingType>("CREDIT_CARD");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [barbershopId, setBarbershopId] = useState("");
  const [barbershopName, setBarbershopName] = useState("");
  const [barbershopEmail, setBarbershopEmail] = useState("");
  const [barbershopPhone, setBarbershopPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState<BillingAddress | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");

  const [holderName, setHolderName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");

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
          "Nao foi possivel carregar os planos. Recarregue a pagina e tente novamente.",
        );
      } else if (plansRes.data?.length) {
        setPlans(plansRes.data);
        setPlansError(null);
      } else {
        setPlans([]);
        setPlansError("Nenhum plano disponivel no momento.");
      }
      setLoadingPlans(false);

      const userId = userRes.data.user?.id;
      if (userId) {
        const { data: shop } = await supabase
          .from("barbershops")
          .select("id, name, email, phone")
          .eq("owner_id", userId)
          .maybeSingle();

        if (!mounted) return;
        if (shop) {
          setBarbershopId(shop.id);
          setBarbershopName(shop.name ?? "");
          setBarbershopEmail(shop.email ?? "");
          setBarbershopPhone(shop.phone ?? "");

          const { data: address } = await supabase
            .from("addresses")
            .select(
              "zip_code, street, number, complement, neighborhood, city, state, country",
            )
            .eq("barbershop_id", shop.id)
            .maybeSingle();

          if (!mounted) return;
          setBillingAddress((address as BillingAddress | null) ?? null);
        }
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const bestValuePlanId = useMemo(() => {
    if (plans.length < 2) return null;
    return plans.reduce((best, plan) =>
      monthlyEquivalentCents(plan) < monthlyEquivalentCents(best) ? plan : best,
    ).id;
  }, [plans]);

  const selectedPlan = useMemo(
    () => plans.find(plan => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  function choosePlan(planId: string) {
    setSelectedPlanId(planId);
    setError(null);
    setDone(false);
    setInvoiceUrl(null);
    setPaymentState("idle");
    setStep(2);
  }

  useEffect(() => {
    if (paymentState !== "processing") return;

    let mounted = true;
    let attempts = 0;

    async function checkPaymentConfirmation() {
      attempts += 1;
      const { data, error: subscriptionError } = await getMySubscription();
      if (!mounted) return;

      if (subscriptionError) {
        setError(subscriptionError);
        return;
      }

      if (data?.status === "active") {
        setPaymentState("confirmed");
        return;
      }

      if (attempts >= 40) {
        setError(
          "Pagamento iniciado, mas a confirmacao ainda nao chegou. Aguarde alguns instantes e atualize a pagina.",
        );
      }
    }

    void checkPaymentConfirmation();
    const interval = window.setInterval(() => {
      void checkPaymentConfirmation();
    }, 3000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [paymentState]);

  function validateCheckout() {
    if (!selectedPlan) return "Selecione um plano.";
    if (!barbershopId) return "Nenhuma barbearia encontrada para o usuario.";
    if (!holderName.trim()) return "Informe o nome do titular.";
    if (!cpfCnpj.trim()) return "Informe o CPF ou CNPJ.";
    if (!isValidCpfCnpj(cpfCnpj)) return "CPF ou CNPJ invalido.";
    if (!barbershopEmail.trim()) return "Sua barbearia esta sem email.";

    if (billingType === "CREDIT_CARD") {
      if (!billingAddress) {
        return "Cadastre o endereco da barbearia antes de assinar.";
      }
      if ((billingAddress.zip_code ?? "").replace(/\D/g, "").length !== 8) {
        return "O endereco da barbearia esta sem CEP valido.";
      }
      if (!billingAddress.number?.trim()) {
        return "O endereco da barbearia esta sem numero.";
      }
      if (cardNumber.replace(/\D/g, "").length < 13) {
        return "Informe o numero do cartao.";
      }
      if (!cardExpiry.trim()) return "Informe a validade do cartao.";
      if (cardCcv.replace(/\D/g, "").length < 3) return "Informe o CVV.";
    }

    return null;
  }

  async function handleSubscribe() {
    const validationError = validateCheckout();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!selectedPlan || submitting) return;

    setSubmitting(true);
    setError(null);
    setDone(false);
    setInvoiceUrl(null);
    setPaymentState("idle");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "new-create-subscription",
        {
          body: {
            barbershop_id: barbershopId,
            plan_id: selectedPlan.id,
            billing_type: billingType,
            holder_name: holderName.trim(),
            company_name: barbershopName.trim(),
            cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
            email: barbershopEmail.trim(),
            mobile_phone: barbershopPhone.replace(/\D/g, "") || undefined,
            postal_code:
              billingAddress?.zip_code?.replace(/\D/g, "") || undefined,
            address: billingAddress?.street ?? undefined,
            address_number: billingAddress?.number ?? undefined,
            address_complement: billingAddress?.complement ?? undefined,
            province: billingAddress?.neighborhood ?? undefined,
            city: billingAddress?.city ?? undefined,
            state: billingAddress?.state ?? undefined,
            country: billingAddress?.country ?? undefined,
            credit_card:
              billingType === "CREDIT_CARD"
                ? {
                    number: cardNumber.replace(/\D/g, ""),
                    expiry: cardExpiry,
                    ccv: cardCcv.replace(/\D/g, ""),
                    holder_name: holderName.trim(),
                  }
                : undefined,
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

      const url =
        (data as { invoice_url?: string | null })?.invoice_url ?? null;
      setInvoiceUrl(url);
      setDone(true);
      setPaymentState("processing");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
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
                Carregando planos...
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
                          /mes
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
                        disabled={!barbershopId}
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
          <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex w-fit items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <ArrowLeft className="size-4" />
                Voltar aos planos
              </button>

              <div>
                <h1 className="text-xl font-semibold">Pagamento</h1>
                <p className="text-sm text-zinc-500">
                  Escolha como quer pagar e preencha os dados abaixo.
                </p>
              </div>

              {paymentState !== "idle" ? (
                <div
                  className={cn(
                    "flex min-h-80 flex-col items-center justify-center rounded-2xl border p-8 text-center",
                    paymentState === "confirmed"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
                  )}
                >
                  {paymentState === "confirmed" ? (
                    <>
                      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                        ✓
                      </div>
                      <h2 className="text-xl font-semibold">
                        Parabens, seu pagamento foi confirmado
                      </h2>
                      <p className="mt-2 max-w-md text-sm">
                        Voce ja pode levar sua barbearia para o proximo nivel
                        com a Virtual.
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="mb-4 size-10 animate-spin" />
                      <h2 className="text-xl font-semibold">
                        Processando pagamento
                      </h2>
                      <p className="mt-2 max-w-md text-sm">
                        Estamos aguardando a confirmacao do Asaas. O acesso sera
                        liberado automaticamente assim que o pagamento for
                        confirmado.
                      </p>
                      {invoiceUrl && (
                        <Button asChild size="lg" className="mt-6">
                          <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Abrir pagamento
                          </a>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {billingOptions.map(option => {
                      const Icon = option.icon;
                      const active = billingType === option.type;

                      return (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => setBillingType(option.type)}
                          className={cn(
                            "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition",
                            active
                              ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/15 dark:bg-blue-950/30 dark:text-blue-300"
                              : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                          )}
                        >
                          <Icon className="size-5" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="holder-name">Nome do titular</Label>
                      <Input
                        id="holder-name"
                        value={holderName}
                        onChange={event => setHolderName(event.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cpf-cnpj">CPF / CNPJ</Label>
                      <Input
                        id="cpf-cnpj"
                        value={cpfCnpj}
                        onChange={event =>
                          setCpfCnpj(
                            event.target.value.replace(/\D/g, "").slice(0, 14),
                          )
                        }
                        placeholder="Somente numeros"
                      />
                    </div>
                  </div>

                  {billingType === "CREDIT_CARD" && (
                    <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="card-number">Numero do cartao</Label>
                        <Input
                          id="card-number"
                          inputMode="numeric"
                          value={cardNumber}
                          onChange={event =>
                            setCardNumber(
                              event.target.value
                                .replace(/\D/g, "")
                                .slice(0, 19),
                            )
                          }
                          placeholder="0000 0000 0000 0000"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="card-expiry">Validade</Label>
                        <Input
                          id="card-expiry"
                          value={cardExpiry}
                          onChange={event => setCardExpiry(event.target.value)}
                          placeholder="MM/AA"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="card-ccv">CVV</Label>
                        <Input
                          id="card-ccv"
                          inputMode="numeric"
                          value={cardCcv}
                          onChange={event =>
                            setCardCcv(
                              event.target.value.replace(/\D/g, "").slice(0, 4),
                            )
                          }
                          placeholder="123"
                        />
                      </div>

                      <p className="text-xs text-zinc-500 sm:col-span-2">
                        Os dados do cartao serao enviados diretamente para a
                        Edge Function e nao devem ser salvos no banco.
                      </p>
                    </div>
                  )}

                  {billingType === "PIX" && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                      Depois de confirmar, vamos gerar o Pix da primeira
                      cobranca e mostrar as instrucoes de pagamento aqui.
                    </div>
                  )}

                  {billingType === "BOLETO" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                      Depois de confirmar, vamos gerar o boleto da primeira
                      cobranca e mostrar o link para pagamento.
                    </div>
                  )}

                  {error && (
                    <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      {error}
                    </p>
                  )}

                  {done && invoiceUrl && (
                    <Button asChild size="lg">
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ir para o pagamento
                      </a>
                    </Button>
                  )}

                  {done && !invoiceUrl && (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                      Assinatura criada! Estamos preparando sua cobranca.
                    </p>
                  )}

                  {!done && (
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => void handleSubscribe()}
                      disabled={submitting}
                    >
                      {submitting && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      {submitting ? "Processando..." : "Finalizar pagamento"}
                    </Button>
                  )}
                </>
              )}
            </div>

            <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">Resumo</p>
              <h2 className="mt-1 text-lg font-semibold">
                {selectedPlan.name}
              </h2>

              <div className="mt-5 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950/50">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-zinc-500">
                    {cycleLabel(selectedPlan.asaas_cycle)}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(selectedPlan.price_cents)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-sm text-zinc-500">
                  <span>Ciclo</span>
                  <span>{cycleSuffix(selectedPlan.asaas_cycle)}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <span className="font-medium">Total hoje</span>
                <span className="text-2xl font-bold">
                  {formatMoney(selectedPlan.price_cents)}
                </span>
              </div>

              {selectedPlan.description && (
                <p className="mt-4 text-sm text-zinc-500">
                  {selectedPlan.description}
                </p>
              )}
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
