/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// asaas-webhook/index.ts — STANDALONE (sem _shared) — C2 + H1
// Deploya em qualquer lugar (dashboard ou CLI). Desligue Verify JWT.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;
const CYCLE_MONTHS: Record<string, number> = {
  WEEKLY: 0,
  BIWEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};
const CONFIRMING_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const FAILING_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_REVERSED",
]);

// M2: comparação em tempo constante (anti timing attack).
// SHA-256 dos dois e compara os digests (tamanho fixo → não vaza length nem
// para no 1º byte diferente).
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ah, bh] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const av = new Uint8Array(ah);
  const bv = new Uint8Array(bh);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function toCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Math.round(n * 100);
}
function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

Deno.serve(async req => {
  if (req.method !== "POST")
    return jsonResponse(405, { error: "method_not_allowed" });

  // -------- 1. Autenticação (token anti-forja) --------
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (!expectedToken) {
    console.error("ASAAS_WEBHOOK_TOKEN não configurado.");
    return jsonResponse(500, { error: "server_misconfigured" });
  }
  if (!receivedToken || !(await safeEqual(receivedToken, expectedToken))) {
    console.warn("Webhook rejeitado: token inválido.");
    return jsonResponse(401, { error: "unauthorized" });
  }

  // -------- 2. Parse do corpo --------
  let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const eventId: string | undefined = body?.id;
  const eventType: string | undefined = body?.event;
  const payment = body?.payment;

  if (!eventId || !eventType) {
    console.warn("Webhook sem id/event:", JSON.stringify(body).slice(0, 500));
    return jsonResponse(200, { ignored: "missing_id_or_event" });
  }

  // -------- Cliente admin (service_role) — inline, sem _shared --------
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse(500, { error: "missing_env" });
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -------- 3. DEDUP por processed_at + registra recebimento --------
  const { data: prior, error: priorErr } = await supabase
    .from("webhook_events")
    .select("processed_at, attempts")
    .eq("asaas_event_id", eventId)
    .maybeSingle();

  if (priorErr) {
    console.error("Erro lendo webhook_events:", priorErr.message);
    return jsonResponse(500, { error: "db_error_reading_event" });
  }
  if (prior?.processed_at) return jsonResponse(200, { duplicate: true });

  const attempts = (prior?.attempts ?? 0) + 1;
  const { error: upsertErr } = await supabase.from("webhook_events").upsert(
    {
      asaas_event_id: eventId,
      event_type: eventType,
      payload: body,
      attempts,
    },
    { onConflict: "asaas_event_id" },
  );
  if (upsertErr) {
    console.error("Erro registrando webhook_event:", upsertErr.message);
    return jsonResponse(500, { error: "db_error_logging_event" });
  }

  // failRetryable: 500 (retry) enquanto attempts < MAX; esgotado, desiste (200).
  async function failRetryable(reason: string): Promise<Response> {
    if (attempts >= MAX_ATTEMPTS) {
      await supabase
        .from("webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          error: `gave_up_after_${attempts}_attempts: ${reason}`,
        })
        .eq("asaas_event_id", eventId);
      await supabase.from("ops_alerts").insert({
        level: "error",
        source: "webhook",
        kind: "gave_up",
        message: reason,
        context: { eventId, eventType },
      });
      console.error(`Webhook desistiu (${attempts}x): ${reason}`);
      return jsonResponse(200, { gave_up: true, reason });
    }
    await supabase
      .from("webhook_events")
      .update({
        error: `retry ${attempts}/${MAX_ATTEMPTS}: ${reason}`,
      })
      .eq("asaas_event_id", eventId);
    console.warn(`Webhook retryable (${attempts}/${MAX_ATTEMPTS}): ${reason}`);
    return jsonResponse(500, { retry: true, reason });
  }

  // -------- 4. Processa o efeito --------
  try {
    if (!payment || typeof payment !== "object") {
      await markProcessed(supabase, eventId, "no_payment_object");
      return jsonResponse(200, { processed: true, note: "no_payment_object" });
    }

    const asaasPaymentId: string | undefined = payment.id;
    const asaasSubscriptionId: string | undefined = payment.subscription;
    const externalRef: string | undefined = payment.externalReference;

    // Pagamentos sem assinatura Asaas (buy-pack) só precisam ser processados
    // em eventos de confirmação — e apenas se houver externalReference para
    // localizar a subscription. Qualquer outro caso sem subscription é ignorado.
    if (
      !asaasSubscriptionId &&
      (!externalRef || !CONFIRMING_EVENTS.has(eventType))
    ) {
      await markProcessed(supabase, eventId, "payment_without_subscription");
      return jsonResponse(200, {
        processed: true,
        note: "not_a_subscription_payment",
      });
    }

    // H1: inclui current_period_end. Inclui asaas_subscription_id para detectar
    // o backfill quando a busca cair no fallback por externalReference.
    const SUB_COLUMNS =
      "id, plan_id, status, current_period_end, asaas_subscription_id, plans:plan_id ( asaas_cycle )";

    // 1ª tentativa: pelo id da assinatura no Asaas (planos mensais recorrentes).
    let sub: any = null;
    if (asaasSubscriptionId) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(SUB_COLUMNS)
        .eq("asaas_subscription_id", asaasSubscriptionId)
        .maybeSingle();
      if (error)
        return await failRetryable(
          `erro buscando subscription: ${error.message}`,
        );
      sub = data;
    }

    // Fallback: pelo externalReference (= barbershop_id).
    // Cobre duas situações:
    //   1. Corrida: webhook chega antes do create-monthly-subscription gravar o id.
    //   2. Pack payment (buy-pack): nunca tem asaas_subscription_id.
    if (!sub && externalRef) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(SUB_COLUMNS)
        .eq("barbershop_id", externalRef)
        .maybeSingle();
      if (error)
        return await failRetryable(
          `erro buscando subscription (ref): ${error.message}`,
        );
      sub = data;
      // Backfill do id apenas para assinaturas recorrentes (pack não tem subscription_id).
      if (sub && !sub.asaas_subscription_id && asaasSubscriptionId) {
        await supabase
          .from("subscriptions")
          .update({ asaas_subscription_id: asaasSubscriptionId })
          .eq("id", sub.id);
      }
    }

    if (!sub) return await failRetryable("subscription_not_found_yet");

    const { error: upsertPaymentError } = await supabase
      .from("payments")
      .upsert(
        {
          subscription_id: sub.id,
          asaas_payment_id: asaasPaymentId,
          amount_cents: toCents(payment.value),
          billing_type: payment.billingType ?? null,
          status: payment.status ?? eventType,
          due_date: payment.dueDate ?? null,
          paid_at: payment.paymentDate
            ? new Date(payment.paymentDate).toISOString()
            : null,
          invoice_url: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
        },
        { onConflict: "asaas_payment_id" },
      );
    if (upsertPaymentError)
      return await failRetryable(
        `erro no upsert de payment: ${upsertPaymentError.message}`,
      );

    if (CONFIRMING_EVENTS.has(eventType)) {
      const cycle: string = sub.plans?.asaas_cycle ?? "MONTHLY";
      const months = CYCLE_MONTHS[cycle] ?? 1;

      // Parcelas 2+ de pack (buy-pack, sem asaas_subscription_id) não devem
      // estender o período — já foi definido na compra ou pela 1ª parcela.
      const installmentNumber: number =
        (payment.installmentNumber as number) ?? 1;
      if (!asaasSubscriptionId && installmentNumber > 1) {
        await markProcessed(supabase, eventId);
        return jsonResponse(200, { processed: true, event: eventType });
      }

      // Âncora ESTÁVEL na cobrança (dueDate), nunca "now": evita dupla contagem
      // quando o create-subscription já ativou para o MESMO pagamento.
      const anchor = payment.dueDate
        ? new Date(payment.dueDate)
        : payment.paymentDate
          ? new Date(payment.paymentDate)
          : new Date();
      const candidate = addMonths(anchor, months);
      // H1: nunca encurta — mantém o MAIOR entre o fim atual e o candidato.
      const current = sub.current_period_end
        ? new Date(sub.current_period_end)
        : null;
      const newPeriodEnd = current && current > candidate ? current : candidate;

      const { error: updErr } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_end: newPeriodEnd.toISOString(),
        })
        .eq("id", sub.id);
      if (updErr)
        return await failRetryable(
          `erro ativando subscription: ${updErr.message}`,
        );
    } else if (FAILING_EVENTS.has(eventType)) {
      const { error: updErr } = await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", sub.id);
      if (updErr)
        return await failRetryable(`erro marcando past_due: ${updErr.message}`);

      // alerta só APÓS o past_due ter sido aplicado com sucesso
      await supabase.from("ops_alerts").insert({
        level: "warning",
        source: "webhook",
        kind: "payment_failed",
        message: `Assinatura ${sub.id} -> past_due (${eventType})`,
        context: { subscriptionId: sub.id, asaasSubscriptionId },
      });
    }

    await markProcessed(supabase, eventId);
    return jsonResponse(200, { processed: true, event: eventType });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado processando webhook:", message);
    return await failRetryable(`unexpected: ${message}`);
  }
});

async function markProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  note?: string,
) {
  await supabase
    .from("webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      ...(note ? { error: `note: ${note}` } : {}),
    })
    .eq("asaas_event_id", eventId);
}
