// _shared/asaas.ts
// Utilitários compartilhados entre as edge functions de pagamento.
// Importar com: import { ... } from "../_shared/asaas.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TIPOS
// ============================================================================

export type BillingType = "CREDIT_CARD" | "PIX";

export type AsaasListResponse<T> = { data?: T[] };

export type AsaasCustomer = { id: string };

export type AsaasSubscription = {
  id: string;
  status?: string;
  deleted?: boolean;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate?: string;
  dateCreated?: string;
  paymentDate?: string;
};

export type AsaasPixQrCode = {
  success?: boolean;
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

export type BillingAddress = {
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
};

export type CustomerPayload = {
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

// ============================================================================
// CONSTANTES
// ============================================================================

export const ALLOWED_BILLING = new Set<BillingType>(["CREDIT_CARD", "PIX"]);

export const CONFIRMING_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);

export const CYCLE_MONTHS: Record<string, number> = {
  WEEKLY: 0,
  BIWEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};

export const UNPAID_STATUSES = new Set([
  "PENDING",
  "OVERDUE",
  "AWAITING_RISK_ANALYSIS",
]);

// ============================================================================
// ERRO ASAAS
// ============================================================================

export class AsaasError extends Error {
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

// ============================================================================
// CLIENTES SUPABASE
// ============================================================================

export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) throw new Error("missing_supabase_admin_env");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export function getUserClient(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("missing_supabase_user_env");
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

// ============================================================================
// CORS
// ============================================================================

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173"
)
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
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

// ============================================================================
// ASAAS HTTP
// ============================================================================

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

export async function asaasFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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

// ============================================================================
// UTILITÁRIOS
// ============================================================================

export function digits(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function isValidCpf(cpf: string): boolean {
  const v = digits(cpf);
  if (v.length !== 11 || /^(\d)\1{10}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(v[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== Number(v[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(v[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === Number(v[10]);
}

function isValidCnpj(cnpj: string): boolean {
  const v = digits(cnpj);
  if (v.length !== 14 || /^(\d)\1{13}$/.test(v)) return false;
  const calc = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(v[i]) * weights[i];
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calc(12) === Number(v[12]) && calc(13) === Number(v[13]);
}

export function isValidCpfCnpj(value: string | undefined): boolean {
  const d = digits(value);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

export function dueDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseCardExpiry(expiry: string | undefined) {
  const d = digits(expiry);
  if (d.length !== 4 && d.length !== 6) return null;
  const month = d.slice(0, 2);
  const year = d.length === 4 ? `20${d.slice(2)}` : d.slice(2);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (monthNumber < 1 || monthNumber > 12 || yearNumber < 2024) return null;
  return { expiryMonth: month, expiryYear: year };
}

export function getRemoteIp(req: Request): string | undefined {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Calcula o novo current_period_end para renovações.
// Se ainda há período válido, estende a partir do fim atual (preserva dias restantes).
// Se expirou ou é nulo, começa do now.
export function computeNewPeriodEnd(
  currentPeriodEnd: string | null | undefined,
  months: number,
): Date {
  const anchor =
    currentPeriodEnd && new Date(currentPeriodEnd) > new Date()
      ? new Date(currentPeriodEnd)
      : new Date();
  return addMonths(anchor, months);
}

export type CouponInfo = {
  id: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  description: string | null;
  uses_count: number;
  max_uses: number | null;
  expires_at: string | null;
};

// Calcula o preço final com desconto. Mínimo de R$1,00 (100 cents).
// discount_type 'fixed': discount_value em reais (ex: 50 = R$50 off).
// discount_type 'percentage': discount_value em % (ex: 20 = 20% off).
export function applyCouponDiscount(
  priceCents: number,
  coupon: Pick<CouponInfo, "discount_type" | "discount_value">,
): number {
  if (coupon.discount_type === "percentage") {
    return Math.max(
      100,
      Math.round(priceCents * (1 - coupon.discount_value / 100)),
    );
  }
  return Math.max(100, priceCents - Math.round(coupon.discount_value * 100));
}

export function pickOldestUnpaidPayment(
  payments: AsaasPayment[],
): AsaasPayment | null {
  const unpaid = (payments ?? [])
    .filter(p => UNPAID_STATUSES.has(p.status ?? ""))
    .sort((a, b) => {
      const dateA = new Date(a.dueDate ?? a.dateCreated ?? 0).getTime();
      const dateB = new Date(b.dueDate ?? b.dateCreated ?? 0).getTime();
      return dateA - dateB;
    });
  return unpaid[0] ?? null;
}

// ============================================================================
// ASAAS API
// ============================================================================

export async function findCustomerByExternalReference(
  externalReference: string,
) {
  const query = new URLSearchParams({ externalReference });
  const response = await asaasFetch<AsaasListResponse<AsaasCustomer>>(
    `/customers?${query}`,
  );
  return response.data?.[0] ?? null;
}

export async function createCustomer(params: CustomerPayload) {
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

export async function updateCustomer(
  customerId: string,
  params: CustomerPayload,
) {
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

export async function findSubscriptionByExternalReference(
  externalReference: string,
) {
  const query = new URLSearchParams({ externalReference });
  const response = await asaasFetch<AsaasListResponse<AsaasSubscription>>(
    `/subscriptions?${query}`,
  );
  return (response.data ?? []).find(sub => !sub.deleted) ?? null;
}

export async function deleteAsaasSubscription(subscriptionId: string) {
  return asaasFetch<{ deleted?: boolean; id?: string }>(
    `/subscriptions/${subscriptionId}`,
    { method: "DELETE" },
  );
}

export async function createSubscription(params: {
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

export async function listSubscriptionPayments(subscriptionId: string) {
  return asaasFetch<AsaasListResponse<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments`,
  );
}

export async function getPixQrCode(paymentId: string) {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}
