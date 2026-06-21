import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Loader2,
  QrCode,
  Tag,
  X,
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

type BillingType = "PIX" | "CREDIT_CARD";
type PaymentState = "idle" | "processing" | "confirmed" | "timedout";

type PixData = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

type AppliedCoupon = {
  id: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  description: string | null;
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
];

const ERROR_MESSAGES: Record<string, string> = {
  subscription_already_exists: "Voce ja possui uma assinatura.",
  provisioning_in_progress:
    "Ja estamos processando sua assinatura. Aguarde um instante.",
  invalid_cpf_cnpj: "CPF ou CNPJ invalido.",
  invalid_credit_card_expiry:
    "Data de validade do cartão inválida. Use o formato MM/AA.",
  missing_cpf_cnpj: "Informe o CPF ou CNPJ.",
  missing_billing_address: "Cadastre o endereco da barbearia antes de assinar.",
  missing_postal_code: "O endereco da barbearia esta sem CEP valido.",
  missing_address_number: "O endereco da barbearia esta sem numero.",
  rate_limited: "Muitas tentativas. Aguarde um instante e tente de novo.",
  invalid_coupon: "Cupom inválido ou inexistente.",
  coupon_expired: "Este cupom expirou.",
  coupon_exhausted: "Este cupom atingiu o limite de usos.",
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

type BuySubscriptionMainProps = {
  currentPlanId?: string | null;
};

export function BuySubscriptionMain({
  currentPlanId = null,
}: BuySubscriptionMainProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [billingType, setBillingType] = useState<BillingType>("CREDIT_CARD");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [barbershopId, setBarbershopId] = useState("");
  const [barbershopName, setBarbershopName] = useState("");
  const [barbershopEmail, setBarbershopEmail] = useState("");
  const [barbershopPhone, setBarbershopPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (paymentState !== "confirmed") return;
    const t = setTimeout(() => void navigate("/minha-assinatura"), 2000);
    return () => clearTimeout(t);
  }, [paymentState, navigate]);

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

  const finalPriceCents = useMemo(() => {
    if (!selectedPlan) return 0;
    if (!appliedCoupon) return selectedPlan.price_cents;
    if (appliedCoupon.discount_type === "percentage") {
      return Math.max(
        100,
        Math.round(
          selectedPlan.price_cents * (1 - appliedCoupon.discount_value / 100),
        ),
      );
    }
    return Math.max(
      100,
      selectedPlan.price_cents - Math.round(appliedCoupon.discount_value * 100),
    );
  }, [selectedPlan, appliedCoupon]);

  function choosePlan(planId: string) {
    const plan = plans.find(p => p.id === planId);
    setSelectedPlanId(planId);
    setError(null);
    setDone(false);
    setInvoiceUrl(null);
    setPixData(null);
    setPixCopied(false);
    setPaymentState("idle");
    setCouponInput("");
    setAppliedCoupon(null);
    setCouponError(null);
    // Define o parcelamento padrão: 6x para semestral, 12x para anual, 1x para mensal.
    const defaultInstallments =
      plan?.asaas_cycle === "SEMIANNUALLY"
        ? 6
        : plan?.asaas_cycle === "YEARLY"
          ? 12
          : 1;
    setInstallmentCount(defaultInstallments);
    setStep(2);
  }

  async function copyPixPayload() {
    if (!pixData?.payload) return;
    try {
      await navigator.clipboard.writeText(pixData.payload);
      setPixCopied(true);
      window.setTimeout(() => setPixCopied(false), 2000);
    } catch {
      // navegador sem permissão de clipboard — usuário copia manualmente.
    }
  }

  // Volta ao passo 1 para o usuário escolher tudo de novo. A cobrança pendente
  // é cancelada no backend quando ele reenviar (cancela e cria outra).
  function restartCheckout() {
    setError(null);
    setDone(false);
    setInvoiceUrl(null);
    setPixData(null);
    setPixCopied(false);
    setPaymentState("idle");
    setCouponInput("");
    setAppliedCoupon(null);
    setCouponError(null);
    setSelectedPlanId(null);
    setStep(1);
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

      // ~2 min (40 x 3s) sem confirmar -> PIX/cartao nao aprovam mais.
      // Para tudo e oferece recomecar a escolha.
      if (attempts >= 40) {
        setPaymentState("timedout");
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

  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    setAppliedCoupon(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("validate_coupon", {
        p_code: code,
      });
      if (rpcError) throw rpcError;
      const result = data as {
        valid: boolean;
        id?: string;
        discount_type?: string;
        discount_value?: number;
        description?: string;
      };
      if (!result?.valid) {
        setCouponError(ERROR_MESSAGES.invalid_coupon);
      } else {
        setAppliedCoupon({
          id: result.id!,
          discount_type: result.discount_type as "percentage" | "fixed",
          discount_value: result.discount_value!,
          description: result.description ?? null,
        });
      }
    } catch {
      setCouponError("Erro ao validar cupom. Tente novamente.");
    } finally {
      setCouponLoading(false);
    }
  }

  function validateCheckout() {
    if (!selectedPlan) return "Selecione um plano.";
    if (!barbershopId) return "Nenhuma barbearia encontrada para o usuario.";
    if (!holderName.trim()) return "Informe o nome do titular.";
    if (!cpfCnpj.trim()) return "Informe o CPF ou CNPJ.";
    if (!isValidCpfCnpj(cpfCnpj)) return "CPF ou CNPJ invalido.";
    if (!barbershopEmail.trim()) return "Sua barbearia esta sem email.";

    if (billingType === "CREDIT_CARD") {
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
    setPixData(null);
    setPixCopied(false);
    setPaymentState("idle");

    try {
      const fn =
        selectedPlan.asaas_cycle === "MONTHLY"
          ? "create-monthly-subscription"
          : "buy-pack";

      const { data, error: invokeError } = await supabase.functions.invoke(fn, {
        body: {
          barbershop_id: barbershopId,
          plan_id: selectedPlan.id,
          billing_type: billingType,
          holder_name: holderName.trim(),
          company_name: barbershopName.trim(),
          cpf_cnpj: cpfCnpj.replace(/\D/g, ""),
          email: barbershopEmail.trim(),
          mobile_phone: barbershopPhone.replace(/\D/g, "") || undefined,
          ...(appliedCoupon
            ? { coupon_code: couponInput.trim().toUpperCase() }
            : {}),
          ...(selectedPlan.asaas_cycle !== "MONTHLY" &&
          billingType === "CREDIT_CARD"
            ? { installment_count: installmentCount }
            : {}),
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
      });

      if (invokeError) {
        const body = await (invokeError as InvokeErrorWithContext).context
          ?.json?.()
          .catch(() => null);
        setError(friendlyErrorFromBody(body) ?? getErrorMessage(invokeError));
        return;
      }

      const response = data as {
        invoice_url?: string | null;
        status?: string;
        pix?: PixData | null;
      };
      setInvoiceUrl(response.invoice_url ?? null);
      setPixData(response.pix ?? null);
      setDone(true);
      setPaymentState(
        response.status === "active" ? "confirmed" : "processing",
      );
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
                  const current = plan.id === currentPlanId;
                  const months = CYCLE_MONTHS[plan.asaas_cycle] || 1;

                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        "relative flex flex-col rounded-2xl border bg-white p-6 transition dark:bg-zinc-900",
                        current
                          ? "border-emerald-500 ring-2 ring-emerald-500/20"
                          : best
                            ? "border-blue-500 ring-1 ring-blue-500/30"
                            : "border-zinc-200 dark:border-zinc-800",
                      )}
                    >
                      {current && (
                        <span className="absolute right-4 top-4 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Sua assinatura atual
                        </span>
                      )}

                      {best && (
                        <span
                          className={cn(
                            "absolute right-4 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white",
                            current ? "top-11" : "top-4",
                          )}
                        >
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
                        variant={best || current ? "default" : "outline"}
                        onClick={() => choosePlan(plan.id)}
                        disabled={!barbershopId}
                        className="mt-6 w-full"
                      >
                        {current
                          ? `Continuar com ${cycleLabel(plan.asaas_cycle)}`
                          : `Escolher ${cycleLabel(plan.asaas_cycle)}`}
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
                      : paymentState === "timedout"
                        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
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
                        Você será redirecionado para sua assinatura em
                        instantes.
                      </p>
                    </>
                  ) : paymentState === "timedout" ? (
                    <>
                      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-amber-500 text-white">
                        !
                      </div>
                      <h2 className="text-xl font-semibold">
                        Nao identificamos seu pagamento
                      </h2>
                      <p className="mt-2 max-w-md text-sm">
                        Nao recebemos a confirmacao do pagamento. Se ja pagou,
                        aguarde mais um pouco e atualize a pagina. Caso
                        contrario, escolha novamente como deseja pagar.
                      </p>
                      <Button
                        type="button"
                        size="lg"
                        className="mt-6"
                        onClick={restartCheckout}
                      >
                        Escolher novamente
                      </Button>
                    </>
                  ) : pixData ? (
                    <>
                      <h2 className="text-xl font-semibold">
                        Pague com Pix para ativar
                      </h2>
                      <p className="mt-2 max-w-md text-sm">
                        Escaneie o QR code ou copie o codigo abaixo. O acesso e
                        liberado automaticamente assim que o pagamento cair.
                      </p>

                      {pixData.encodedImage && (
                        <img
                          src={`data:image/png;base64,${pixData.encodedImage}`}
                          alt="QR code do Pix"
                          className="mt-5 size-56 rounded-xl bg-white p-3"
                        />
                      )}

                      {pixData.payload && (
                        <div className="mt-5 flex w-full max-w-md items-center gap-2 rounded-lg border border-blue-200 bg-white p-2 dark:border-blue-900 dark:bg-zinc-900">
                          <span className="flex-1 truncate font-mono text-xs text-zinc-700 dark:text-zinc-300">
                            {pixData.payload}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyPixPayload()}
                            className="max-w-22"
                          >
                            {pixCopied ? "Copiado!" : "Copiar"}
                          </Button>
                        </div>
                      )}

                      <div className="mt-5 flex items-center gap-2 text-sm">
                        <Loader2 className="size-4 animate-spin" />
                        Aguardando confirmacao do pagamento...
                      </div>
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {billingOptions.map(option => {
                      const Icon = option.icon;
                      const active = billingType === option.type;

                      return (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => setBillingType(option.type)}
                          className={cn(
                            "flex h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition",
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

                  {selectedPlan.asaas_cycle !== "MONTHLY" &&
                    billingType === "CREDIT_CARD" && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="installments">Parcelamento</Label>
                        <select
                          id="installments"
                          value={installmentCount}
                          onChange={e =>
                            setInstallmentCount(Number(e.target.value))
                          }
                          className="flex h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
                        >
                          {Array.from(
                            {
                              length:
                                selectedPlan.asaas_cycle === "YEARLY" ? 12 : 6,
                            },
                            (_, i) => i + 1,
                          ).map(n => (
                            <option key={n} value={n}>
                              {n === 1
                                ? `1x de ${formatMoney(finalPriceCents)} (à vista)`
                                : `${n}x de ${formatMoney(Math.ceil(finalPriceCents / n))}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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
                        <Label htmlFor="card-number">Número do cartão</Label>
                        <Input
                          id="card-number"
                          inputMode="numeric"
                          value={cardNumber}
                          onChange={event => {
                            const digits = event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 16);
                            setCardNumber(
                              digits.replace(/(.{4})/g, "$1 ").trim(),
                            );
                          }}
                          placeholder="0000 0000 0000 0000"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="card-expiry">Validade</Label>
                        <Input
                          id="card-expiry"
                          inputMode="numeric"
                          value={cardExpiry}
                          onChange={event => {
                            const digits = event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 4);
                            setCardExpiry(
                              digits.length > 2
                                ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                                : digits,
                            );
                          }}
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
                              event.target.value.replace(/\D/g, "").slice(0, 3),
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
                      cobranca e mostrar o QR code aqui.
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
                  <span
                    className={cn(
                      "font-semibold",
                      appliedCoupon &&
                        "text-zinc-400 line-through dark:text-zinc-600",
                    )}
                  >
                    {formatMoney(selectedPlan.price_cents)}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="mt-1.5 flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <Tag className="size-3" />
                      {couponInput.trim().toUpperCase()}
                    </span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      -
                      {appliedCoupon.discount_type === "percentage"
                        ? `${appliedCoupon.discount_value}%`
                        : formatMoney(appliedCoupon.discount_value * 100)}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-4 text-sm text-zinc-500">
                  <span>Ciclo</span>
                  <span>{cycleSuffix(selectedPlan.asaas_cycle)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                <Label
                  htmlFor="coupon-code"
                  className="flex items-center gap-1.5 text-xs text-zinc-500"
                >
                  <Tag className="size-3" />
                  Cupom de desconto
                </Label>
                {appliedCoupon ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <CheckCircle className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="flex-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      {couponInput.trim().toUpperCase()}
                      {appliedCoupon.description
                        ? ` — ${appliedCoupon.description}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponInput("");
                        setCouponError(null);
                      }}
                      className="text-emerald-600 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
                      aria-label="Remover cupom"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Input
                      id="coupon-code"
                      value={couponInput}
                      onChange={e => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") void handleApplyCoupon();
                      }}
                      placeholder="LANCAMENTO50OFF"
                      className="h-8 text-xs uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleApplyCoupon()}
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Aplicar"
                      )}
                    </Button>
                  </div>
                )}
                {couponError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {couponError}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <span className="font-medium">Total hoje</span>
                <span className="text-2xl font-bold">
                  {formatMoney(finalPriceCents)}
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
