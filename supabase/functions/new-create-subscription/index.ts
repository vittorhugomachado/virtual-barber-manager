/* eslint-disable @typescript-eslint/no-unused-vars */
// new-create-subscription/index.ts
// ============================================================================
// Converte um trial em assinatura paga usando checkout transparente.
//
// Chamada PELO DONO logado no manager (verify_jwt = true).
//
// Fluxo:
//   1. Autentica o usuario (JWT do Supabase).
//   2. Valida que ele e DONO da barbershop.
//   3. Le o plano do banco. Preco/ciclo nunca vem do request.
//   4. Cria/reusa customer no Asaas.
//   5. Cria a assinatura no Asaas.
//      - CREDIT_CARD: envia creditCard + creditCardHolderInfo.
//      - PIX/BOLETO: cria assinatura e devolve invoice_url da primeira cobranca.
//   6. Grava IDs no banco. Status fica incomplete ate webhook confirmar.
//   7. Devolve invoice_url quando existir.
//
// Seguranca:
//   - Nunca salva numero do cartao nem CVV.
//   - Escrita via service_role.
//   - Customer/assinatura usam externalReference = barbershopId para idempotencia.
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";

type RequestBody = {
  barbershop_id?: string;
  plan_id?: string;
  billing_type?: BillingType;
  holder_name?: string;
  company_name?: string;
  cpf_cnpj?: string;
  email?: string;
  mobile_phone?: string;
  postal_code?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  province?: string;
  city?: string;
  state?: string;
  country?: string;
  credit_card?: {
    number?: string;
    expiry?: string;
    ccv?: string;
    holder_name?: string;
  };
};

type AsaasListResponse<T> = {
  data?: T[];
};

type AsaasCustomer = {
  id: string;
};

type AsaasSubscription = {
  id: string;
};

type AsaasPayment = {
  id: string;
  status?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate?: string;
  dateCreated?: string;
  paymentDate?: string;
};

type BillingAddress = {
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
};

type CustomerPayload = {
  name: string;
  companyName?: string;
  cpfCnpj: string;
  email: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference: string;
};

class AsaasError extends Error {
  code?: string;
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
    this.details = details;

    if (details && typeof details === "object") {
      const firstError = (details as { errors?: Array<{ code?: string }> })
        .errors?.[0];
      this.code = firstError?.code;
    }
  }
}

const ALLOWED_BILLING = new Set<BillingType>(["CREDIT_CARD", "PIX", "BOLETO"]);

const CONFIRMING_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);

const CYCLE_MONTHS: Record<string, number> = {
  WEEKLY: 0,
  BIWEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173"
)
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const UNPAID_STATUSES = new Set([
  "PENDING",
  "OVERDUE",
  "AWAITING_RISK_ANALYSIS",
]);

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("missing_supabase_admin_env");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function getUserClient(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error("missing_supabase_user_env");
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

function getAsaasBaseUrl() {
  return (
    Deno.env.get("ASAAS_BASE_URL") ??
    Deno.env.get("ASAAS_API_URL") ??
    "https://api-sandbox.asaas.com/v3"
  ).replace(/\/$/, "");
}

function getAsaasApiKey() {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("missing_asaas_api_key");
  return apiKey;
}

async function asaasFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: getAsaasApiKey(),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      body?.errors?.[0]?.description ??
      body?.message ??
      `Asaas HTTP ${response.status}`;
    throw new AsaasError(response.status, message, body);
  }

  return body as T;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function digits(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function isValidCpf(cpf: string): boolean {
  const value = digits(cpf);
  if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(value[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== Number(value[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(value[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;

  return d2 === Number(value[10]);
}

function isValidCnpj(cnpj: string): boolean {
  const value = digits(cnpj);
  if (value.length !== 14 || /^(\d)\1{13}$/.test(value)) return false;

  const calc = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(value[i]) * weights[i];
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calc(12) === Number(value[12]) && calc(13) === Number(value[13]);
}

function isValidCpfCnpj(value: string | undefined): boolean {
  const onlyDigits = digits(value);
  if (onlyDigits.length === 11) return isValidCpf(onlyDigits);
  if (onlyDigits.length === 14) return isValidCnpj(onlyDigits);
  return false;
}

function dueDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseCardExpiry(expiry: string | undefined) {
  const onlyDigits = digits(expiry);
  if (onlyDigits.length !== 4 && onlyDigits.length !== 6) return null;

  const month = onlyDigits.slice(0, 2);
  const year =
    onlyDigits.length === 4 ? `20${onlyDigits.slice(2)}` : onlyDigits.slice(2);
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  if (monthNumber < 1 || monthNumber > 12 || yearNumber < 2024) return null;

  return { expiryMonth: month, expiryYear: year };
}

function pickOldestUnpaidInvoiceUrl(payments: AsaasPayment[]): string | null {
  const unpaid = (payments ?? [])
    .filter(payment => UNPAID_STATUSES.has(payment.status ?? ""))
    .sort((a, b) => {
      const dateA = new Date(a.dueDate ?? a.dateCreated ?? 0).getTime();
      const dateB = new Date(b.dueDate ?? b.dateCreated ?? 0).getTime();
      return dateA - dateB;
    });

  return unpaid[0]?.invoiceUrl ?? unpaid[0]?.bankSlipUrl ?? null;
}

function getRemoteIp(req: Request): string | undefined {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

async function findCustomerByExternalReference(externalReference: string) {
  const query = new URLSearchParams({ externalReference });
  const response = await asaasFetch<AsaasListResponse<AsaasCustomer>>(
    `/customers?${query}`,
  );
  return response.data?.[0] ?? null;
}

async function createCustomer(params: CustomerPayload) {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      company: params.companyName,
      cpfCnpj: params.cpfCnpj,
      email: params.email,
      mobilePhone: params.mobilePhone,
      postalCode: params.postalCode,
      address: params.address,
      addressNumber: params.addressNumber,
      complement: params.complement,
      province: params.province,
      externalReference: params.externalReference,
    }),
  });
}

async function updateCustomer(customerId: string, params: CustomerPayload) {
  return asaasFetch<AsaasCustomer>(`/customers/${customerId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: params.name,
      company: params.companyName,
      cpfCnpj: params.cpfCnpj,
      email: params.email,
      mobilePhone: params.mobilePhone,
      postalCode: params.postalCode,
      address: params.address,
      addressNumber: params.addressNumber,
      complement: params.complement,
      province: params.province,
      externalReference: params.externalReference,
    }),
  });
}

async function findSubscriptionByExternalReference(externalReference: string) {
  const query = new URLSearchParams({ externalReference });
  const response = await asaasFetch<AsaasListResponse<AsaasSubscription>>(
    `/subscriptions?${query}`,
  );
  return response.data?.[0] ?? null;
}

async function createSubscription(params: {
  customer: string;
  billingType: BillingType;
  value: number;
  cycle: string;
  nextDueDate: string;
  description: string;
  externalReference: string;
  holderName: string;
  cpfCnpj: string;
  email: string;
  mobilePhone?: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
  creditCard?: {
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
    holderName: string;
  };
  remoteIp?: string;
}) {
  const payload: Record<string, unknown> = {
    customer: params.customer,
    billingType: params.billingType,
    value: params.value,
    cycle: params.cycle,
    nextDueDate: params.nextDueDate,
    description: params.description,
    externalReference: params.externalReference,
  };

  if (params.billingType === "CREDIT_CARD" && params.creditCard) {
    payload.creditCard = {
      holderName: params.creditCard.holderName,
      number: params.creditCard.number,
      expiryMonth: params.creditCard.expiryMonth,
      expiryYear: params.creditCard.expiryYear,
      ccv: params.creditCard.ccv,
    };
    payload.creditCardHolderInfo = {
      name: params.holderName,
      email: params.email,
      cpfCnpj: params.cpfCnpj,
      mobilePhone: params.mobilePhone,
      postalCode: params.postalCode,
      addressNumber: params.addressNumber,
      addressComplement: params.addressComplement,
    };
    payload.remoteIp = params.remoteIp;
  }

  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function listSubscriptionPayments(subscriptionId: string) {
  return asaasFetch<AsaasListResponse<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments`,
  );
}

Deno.serve(async req => {
  const cors = corsHeaders(req);
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, { error: "missing_authorization" });
  }

  const userClient = getUserClient(authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return json(401, { error: "invalid_token" });
  }

  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const barbershopId = body.barbershop_id;
  const planId = body.plan_id;
  const billingType = body.billing_type ?? "CREDIT_CARD";
  const holderName = body.holder_name?.trim();
  const companyName = body.company_name?.trim();
  const cpfCnpj = digits(body.cpf_cnpj);
  const email = body.email?.trim();
  const mobilePhone = digits(body.mobile_phone) || undefined;
  const remoteIp = getRemoteIp(req);

  if (!barbershopId || !planId) {
    return json(400, { error: "missing_barbershop_id_or_plan_id" });
  }
  if (!ALLOWED_BILLING.has(billingType)) {
    return json(400, { error: "invalid_billing_type" });
  }
  if (!holderName) {
    return json(400, { error: "missing_holder_name" });
  }
  if (!email) {
    return json(400, { error: "missing_email" });
  }
  if (!isValidCpfCnpj(cpfCnpj)) {
    return json(400, { error: "invalid_cpf_cnpj" });
  }

  const expiry = parseCardExpiry(body.credit_card?.expiry);
  const creditCard =
    billingType === "CREDIT_CARD"
      ? {
          number: digits(body.credit_card?.number),
          ccv: digits(body.credit_card?.ccv),
          holderName: body.credit_card?.holder_name?.trim() || holderName,
          expiryMonth: expiry?.expiryMonth ?? "",
          expiryYear: expiry?.expiryYear ?? "",
        }
      : undefined;

  if (billingType === "CREDIT_CARD") {
    if (!remoteIp) {
      return json(400, { error: "missing_remote_ip" });
    }
    if (!creditCard || creditCard.number.length < 13) {
      return json(400, { error: "missing_credit_card_number" });
    }
    if (!expiry) {
      return json(400, { error: "invalid_credit_card_expiry" });
    }
    if (creditCard.ccv.length < 3) {
      return json(400, { error: "missing_credit_card_ccv" });
    }
  }

  const supabase = getSupabaseAdmin();

  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    "asaas_rate_limit_hit",
    {
      p_key: `create-sub:${userId}`,
      p_max: 8,
      p_window_seconds: 60,
    },
  );

  if (rateLimitError) {
    console.error("Erro no rate limit:", rateLimitError.message);
  } else if (!allowed) {
    return json(429, {
      error: "rate_limited",
      message: "Muitas tentativas. Aguarde um instante e tente novamente.",
    });
  }

  let subscriptionCreated = false;
  let claimedSubId: string | null = null;

  try {
    const { data: shop, error: shopError } = await supabase
      .from("barbershops")
      .select("id, name, owner_id")
      .eq("id", barbershopId)
      .maybeSingle();

    if (shopError) throw shopError;
    if (!shop || shop.owner_id !== userId) {
      return json(403, { error: "not_barbershop_owner" });
    }

    const { data: billingAddress, error: addressError } = await supabase
      .from("addresses")
      .select("zip_code, street, number, complement, neighborhood")
      .eq("barbershop_id", barbershopId)
      .maybeSingle();

    if (addressError) throw addressError;

    const address = billingAddress as BillingAddress | null;
    const postalCode = digits(address?.zip_code) || undefined;
    const addressStreet = address?.street?.trim();
    const addressNumber = address?.number?.trim();
    const addressComplement = address?.complement?.trim();
    const province = address?.neighborhood?.trim();

    if (billingType === "CREDIT_CARD") {
      if (!address) {
        return json(400, { error: "missing_billing_address" });
      }
      if (!postalCode || postalCode.length !== 8) {
        return json(400, { error: "missing_postal_code" });
      }
      if (!addressNumber) {
        return json(400, { error: "missing_address_number" });
      }
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, name, price_cents, asaas_cycle, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan || !plan.is_active) {
      return json(400, { error: "invalid_or_inactive_plan" });
    }

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("id, status, asaas_customer_id, asaas_subscription_id")
      .eq("barbershop_id", barbershopId)
      .maybeSingle();

    if (subError) throw subError;
    if (!sub) {
      return json(409, { error: "no_subscription_row" });
    }
    if (sub.asaas_subscription_id) {
      return json(409, {
        error: "subscription_already_exists",
        asaas_subscription_id: sub.asaas_subscription_id,
      });
    }

    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_subscription_provisioning",
      { p_id: sub.id },
    );

    if (claimError) throw claimError;
    if (!claimed) {
      return json(409, { error: "provisioning_in_progress" });
    }
    claimedSubId = sub.id;

    const customerPayload: CustomerPayload = {
      name: holderName,
      companyName,
      cpfCnpj,
      email,
      mobilePhone,
      postalCode,
      address: addressStreet,
      addressNumber,
      complement: addressComplement,
      province,
      externalReference: barbershopId,
    };

    let customerId = sub.asaas_customer_id;
    if (!customerId) {
      const existing = await findCustomerByExternalReference(barbershopId);
      if (existing) {
        customerId = existing.id;
      } else {
        const customer = await createCustomer(customerPayload);
        customerId = customer.id;
      }

      const { error: customerUpdateError } = await supabase
        .from("subscriptions")
        .update({ asaas_customer_id: customerId })
        .eq("id", sub.id);

      if (customerUpdateError) throw customerUpdateError;
    }

    await updateCustomer(customerId, customerPayload);

    let subscription = await findSubscriptionByExternalReference(barbershopId);
    if (!subscription) {
      subscription = await createSubscription({
        customer: customerId,
        billingType,
        value: plan.price_cents / 100,
        cycle: plan.asaas_cycle,
        nextDueDate: dueDateInDays(0),
        description: `Virtual Barber - ${plan.name}`,
        externalReference: barbershopId,
        holderName,
        cpfCnpj,
        email,
        mobilePhone,
        postalCode,
        addressNumber,
        addressComplement,
        creditCard,
        remoteIp,
      });
    }

    const asaasSubscriptionId = subscription.id;

    const { data: updatedRows, error: updateError } = await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        asaas_subscription_id: asaasSubscriptionId,
        provisioning_started_at: null,
      })
      .eq("id", sub.id)
      .select("id");

    if (updateError) throw updateError;
    if (!updatedRows?.length) {
      console.error(
        `DB update retornou 0 linhas para subscription ${sub.id}.`,
      );
      throw new Error("db_update_zero_rows");
    }

    subscriptionCreated = true;

    let invoiceUrl: string | null = null;
    let activatedDirectly = false;
    try {
      const payments = await listSubscriptionPayments(asaasSubscriptionId);
      invoiceUrl = pickOldestUnpaidInvoiceUrl(payments.data ?? []);

      // Ativa imediatamente se o pagamento já foi confirmado (cartão aprovado na hora).
      // Evita depender do webhook chegar para sair do status "incomplete".
      const confirmedPayment = (payments.data ?? []).find(p =>
        CONFIRMING_STATUSES.has(p.status ?? ""),
      );
      if (confirmedPayment) {
        const months = CYCLE_MONTHS[plan.asaas_cycle] ?? 1;
        // Âncora ESTÁVEL na cobrança (dueDate), nunca "now" — assim este caminho
        // e o webhook calculam o MESMO current_period_end e não somam duplicado.
        const anchor = confirmedPayment.dueDate
          ? new Date(confirmedPayment.dueDate)
          : confirmedPayment.paymentDate
            ? new Date(confirmedPayment.paymentDate)
            : new Date();
        const { error: activateError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: addMonths(anchor, months).toISOString(),
          })
          .eq("id", sub.id);
        if (!activateError) activatedDirectly = true;
      }
    } catch (_error) {
      // O webhook PAYMENT_CREATED/CONFIRMED ainda pode entregar a URL depois.
    }

    return json(200, {
      ok: true,
      billing_type: billingType,
      asaas_subscription_id: asaasSubscriptionId,
      invoice_url: invoiceUrl,
      ...(activatedDirectly ? { status: "active" } : {}),
    });
  } catch (error) {
    if (claimedSubId && !subscriptionCreated) {
      await supabase
        .from("subscriptions")
        .update({ provisioning_started_at: null })
        .eq("id", claimedSubId);
    }

    if (error instanceof AsaasError) {
      console.error("AsaasError:", error.status, error.code, error.message);
      return json(422, {
        error: "asaas_error",
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    console.error("Erro inesperado em new-create-subscription:", error);
    return json(500, { error: "internal_error" });
  }
});
