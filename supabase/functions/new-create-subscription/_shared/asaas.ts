/* eslint-disable @typescript-eslint/no-explicit-any */
// _shared/asaas.ts
// Cliente HTTP do Asaas. Lê chave e URL base do ambiente, de modo que
// trocar sandbox -> produção é trocar dois secrets, sem mexer no código.

const BASE_URL =
  Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";
const API_KEY = Deno.env.get("ASAAS_API_KEY");
const USER_AGENT = Deno.env.get("ASAAS_USER_AGENT") ?? "VirtualBarber";
const TIMEOUT_MS = Number(Deno.env.get("ASAAS_TIMEOUT_MS") ?? "10000");

type AsaasFetchOptions = {
  method?: string;
  body?: Record<string, unknown>;
};

// Wrapper que injeta headers obrigatórios e trata erro de forma uniforme.
export async function asaasFetch(path: string, opts: AsaasFetchOptions = {}) {
  const { method = "GET", body } = opts;

  // Guarda da key: falha rápido e claro (a key NUNCA é logada).
  if (!API_KEY) {
    throw new AsaasError(
      "ASAAS_API_KEY ausente no ambiente.",
      500,
      "server_misconfigured",
      null,
    );
  }

  // Timeout via AbortController — corta em TIMEOUT_MS se o Asaas travar.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        access_token: API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // Timeout (abort) ou erro de rede (DNS/conexão) -> AsaasError uniforme.
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AsaasError(
        `Timeout após ${TIMEOUT_MS}ms`,
        504,
        "timeout",
        null,
      );
    }
    throw new AsaasError(
      `Falha de rede: ${err instanceof Error ? err.message : String(err)}`,
      502,
      "network_error",
      null,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const description = data?.errors?.[0]?.description ?? `HTTP ${res.status}`;
    const code = data?.errors?.[0]?.code ?? "asaas_error";
    throw new AsaasError(description, res.status, code, data);
  }

  return data;
}

export class AsaasError extends Error {
  status: number;
  code: string;
  payload: unknown;
  constructor(message: string, status: number, code: string, payload: unknown) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

// --- Helpers de domínio -------------------------------------------------

export async function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  mobilePhone?: string;
  email?: string;
  externalReference?: string;
}) {
  return await asaasFetch("/customers", { method: "POST", body: input });
}

export async function createSubscription(input: {
  customer: string;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO" | "UNDEFINED";
  value: number; // em reais (ex.: 39.90)
  cycle: string; // MONTHLY | SEMIANNUALLY | YEARLY ...
  nextDueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
}) {
  return await asaasFetch("/subscriptions", { method: "POST", body: input });
}

// Lista as cobranças de uma assinatura (pra extrair o invoiceUrl da 1ª).
export async function listSubscriptionPayments(subscriptionId: string) {
  return await asaasFetch(`/subscriptions/${subscriptionId}/payments`);
}

export async function findCustomerByExternalReference(ref: string) {
  const res = await asaasFetch(
    `/customers?externalReference=${encodeURIComponent(ref)}&limit=1`,
  );
  return res?.data?.[0] ?? null;
}

export async function findSubscriptionByExternalReference(ref: string) {
  const res = await asaasFetch(
    `/subscriptions?externalReference=${encodeURIComponent(ref)}&limit=1`,
  );
  return res?.data?.[0] ?? null;
}
