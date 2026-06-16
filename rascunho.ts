// O QUE ESTE CÓDIGO FAZ
// ----------------------------------------------------------------------------
// Recebe os webhooks de cobrança do Asaas e sincroniza o estado de billing no
// nosso banco. É o ÚNICO caminho que muda o acesso pago de uma barbearia.
//
// MODELO MENTAL (o conserto do C2):
//   "RECEBIDO" (a linha existe em webhook_events) é DIFERENTE de
//   "PROCESSADO/ENTREGUE" (processed_at preenchido = o efeito realmente rolou).
//   => Só ignoramos um evento se ele já foi PROCESSADO. Se foi só recebido mas
//      o processamento falhou, NÃO marcamos processed e pedimos retry (500),
//      para o Asaas reenviar — em vez de perder o efeito para sempre.
//
// COMO LIDAMOS COM FALHA (sem travar a fila Sequencial do Asaas):
//   - Falha retryable e ainda dentro do limite (attempts < MAX) -> 500 (reenvia).
//   - Falha retryable que ESGOTOU o limite -> 200 + marca "gave_up"; a
//     reconciliação (job S4) conserta depois. Assim a fila nunca trava p/ sempre.
//   - Caso terminal (evento sem cobrança de assinatura) -> 200 + processed.
//   - Duplicata real (já processado) -> 200 no-op.
//
// PRINCÍPIOS:
//   - Valida o token secreto ANTES de tudo (anti-forja).
//   - Acesso libera no PAYMENT_CONFIRMED (não espera RECEIVED, que no cartão
//     chega só ~32 dias depois).
//   - Toda escrita roda com service_role.
// ============================================================================

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Quantas vezes deixamos o Asaas reenviar antes de desistir e cair na
// reconciliação. Evita fila travada para sempre num evento "envenenado".
const MAX_ATTEMPTS = 5;

// --- Mapeamento de ciclo do Asaas -> meses a avançar ------------------------
const CYCLE_MONTHS: Record<string, number> = {
  WEEKLY: 0, // não usamos, mas evita undefined
  BIWEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};

// Eventos que CONFIRMAM pagamento -> libera/renova acesso.
const CONFIRMING_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

// Eventos que indicam perda do valor -> volta para past_due.
const FAILING_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_REVERSED",
]);

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Converte para centavos a partir do value decimal do Asaas (39.9 -> 3990).
function toCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Math.round(n * 100);
}

// Avança uma data por N meses, preservando o dia quando possível.
// NOTA (H1, pendente): hoje ancora em paymentDate, o que é idempotente p/ o
// mesmo pagamento (reprocessar dá o mesmo resultado). Quando o H1 trocar para
// max(current_period_end, paymentDate)+ciclo, ESTA dedup por processed_at passa
// a ser obrigatória — por isso o C2 vem antes do H1.
function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

Deno.serve(async (req) => {
  // ========================================================================
  // PASSO 0 — Só aceitamos POST.
  // ========================================================================
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  // ========================================================================
  // PASSO 1 — Autenticação do webhook (anti-forja). É a PRIMEIRA coisa.
  // ========================================================================
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");

  if (!expectedToken) {
    // Erro de configuração NOSSO. 500 faz o Asaas reenviar quando arrumarmos.
    console.error("ASAAS_WEBHOOK_TOKEN não configurado.");
    return jsonResponse(500, { error: "server_misconfigured" });
  }
  if (receivedToken !== expectedToken) {
    // Token errado = não é o Asaas. 401 e ponto.
    console.warn("Webhook rejeitado: token inválido.");
    return jsonResponse(401, { error: "unauthorized" });
  }

  // ========================================================================
  // PASSO 2 — Parse do corpo e extração dos campos que importam.
  // ========================================================================
  let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const eventId: string | undefined = body?.id;
  const eventType: string | undefined = body?.event;
  const payment = body?.payment;

  // Sem id ou tipo não dá para deduplicar. É terminal (não adianta reenviar):
  // respondemos 200 para o Asaas não ficar insistindo em algo intratável.
  if (!eventId || !eventType) {
    console.warn("Webhook sem id/event:", JSON.stringify(body).slice(0, 500));
    return jsonResponse(200, { ignored: "missing_id_or_event" });
  }

  const supabase = getSupabaseAdmin();

  // ========================================================================
  // PASSO 3 — DEDUP por "PROCESSADO" + registro do RECEBIMENTO.
  //   3a. Se já foi PROCESSADO antes (processed_at != null) -> duplicata real.
  //   3b. Senão, registra o recebimento e incrementa o contador de tentativas.
  // ========================================================================

  // 3a. Olha o estado atual do evento (sem queimar nada).
  const { data: prior, error: priorErr } = await supabase
    .from("webhook_events")
    .select("processed_at, attempts")
    .eq("asaas_event_id", eventId)
    .maybeSingle();

  if (priorErr) {
    // Nem conseguimos LER o estado: erro transitório -> 500 para reenviar.
    console.error("Erro lendo webhook_events:", priorErr.message);
    return jsonResponse(500, { error: "db_error_reading_event" });
  }

  // "Entregue" antes? Então é duplicata de verdade -> no-op.
  if (prior?.processed_at) {
    return jsonResponse(200, { duplicate: true });
  }

  // 3b. Registra o recebimento (upsert: não falha se a linha já existe) e
  //     incrementa as tentativas. ISSO é "recebido", NÃO "processado".
  const attempts = (prior?.attempts ?? 0) + 1;
  const { error: upsertErr } = await supabase
    .from("webhook_events")
    .upsert(
      { asaas_event_id: eventId, event_type: eventType, payload: body, attempts },
      { onConflict: "asaas_event_id" },
    );

  if (upsertErr) {
    console.error("Erro registrando webhook_event:", upsertErr.message);
    return jsonResponse(500, { error: "db_error_logging_event" });
  }

  // Helper de falha retryable: decide entre PEDIR RETRY (500) e DESISTIR (200).
  // É a peça que garante "nada perdido em silêncio" sem "fila travada p/ sempre".
  async function failRetryable(reason: string): Promise<Response> {
    if (attempts >= MAX_ATTEMPTS) {
      // Esgotou: desiste de forma controlada para LIBERAR a fila do Asaas.
      // Marca processed_at + erro "gave_up" -> a reconciliação (S4) assume.
      await supabase
        .from("webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          error: `gave_up_after_${attempts}_attempts: ${reason}`,
        })
        .eq("asaas_event_id", eventId);
      console.error(`Webhook desistiu (${attempts}x): ${reason}`);
      return jsonResponse(200, { gave_up: true, reason });
    }
    // Ainda dentro do limite: registra e pede retry (500). NÃO marca processed.
    await supabase
      .from("webhook_events")
      .update({ error: `retry ${attempts}/${MAX_ATTEMPTS}: ${reason}` })
      .eq("asaas_event_id", eventId);
    console.warn(`Webhook retryable (${attempts}/${MAX_ATTEMPTS}): ${reason}`);
    return jsonResponse(500, { retry: true, reason });
  }

  // ========================================================================
  // PASSO 4 — Processa o efeito. Falha aqui = NÃO marca processed.
  // ========================================================================
  try {
    // 4a. Evento sem objeto payment (ex.: alguns de assinatura). É TERMINAL:
    //     não há cobrança para sincronizar -> marca processado e encerra.
    if (!payment || typeof payment !== "object") {
      await markProcessed(supabase, eventId, "no_payment_object");
      return jsonResponse(200, { processed: true, note: "no_payment_object" });
    }

    const asaasPaymentId: string | undefined = payment.id;
    const asaasSubscriptionId: string | undefined = payment.subscription;

    // 4b. Cobrança avulsa (sem assinatura) não é mensalidade. TERMINAL: nunca
    //     vai virar assinatura -> marca processado e encerra (não é retryable).
    if (!asaasSubscriptionId) {
      await markProcessed(supabase, eventId, "payment_without_subscription");
      return jsonResponse(200, { processed: true, note: "not_a_subscription_payment" });
    }

    // 4c. Localiza a subscription pelo id do Asaas.
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status, plans:plan_id ( asaas_cycle )")
      .eq("asaas_subscription_id", asaasSubscriptionId)
      .maybeSingle();

    // Erro de banco ao buscar = transitório -> RETRY (não perde o evento).
    if (subError) {
      return await failRetryable(`erro buscando subscription: ${subError.message}`);
    }

    // *** O CORAÇÃO DO C2 ***
    // Não encontrada: é a CORRIDA (o webhook chegou antes do create-subscription
    // gravar o asaas_subscription_id). ANTES isso marcava processado e perdia o
    // evento. AGORA pedimos RETRY: em segundos o id é gravado e o reenvio acha.
    // Se nunca aparecer (ex.: create-subscription crashou), as tentativas se
    // esgotam e a reconciliação (S4) cuida — sem travar a fila para sempre.
    if (!sub) {
      return await failRetryable("subscription_not_found_yet");
    }

    // 4d. Espelha a cobrança (upsert por asaas_payment_id).
    const paymentRow = {
      subscription_id: sub.id,
      asaas_payment_id: asaasPaymentId,
      amount_cents: toCents(payment.value),
      billing_type: payment.billingType ?? null,
      status: payment.status ?? eventType,
      due_date: payment.dueDate ?? null,
      paid_at: payment.paymentDate ? new Date(payment.paymentDate).toISOString() : null,
      invoice_url: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
    };

    const { error: upsertPaymentError } = await supabase
      .from("payments")
      .upsert(paymentRow, { onConflict: "asaas_payment_id" });

    if (upsertPaymentError) {
      return await failRetryable(`erro no upsert de payment: ${upsertPaymentError.message}`);
    }

    // 4e. Atualiza a subscription conforme o tipo de evento.
    if (CONFIRMING_EVENTS.has(eventType)) {
      // Pagamento confirmado -> ativa e avança o período.
      const cycle: string = sub.plans?.asaas_cycle ?? "MONTHLY";
      const months = CYCLE_MONTHS[cycle] ?? 1;
      const base = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
      const newPeriodEnd = addMonths(base, months);

      const { error: updErr } = await supabase
        .from("subscriptions")
        .update({ status: "active", current_period_end: newPeriodEnd.toISOString() })
        .eq("id", sub.id);

      if (updErr) return await failRetryable(`erro ativando subscription: ${updErr.message}`);

    } else if (FAILING_EVENTS.has(eventType)) {
      // Venceu / estornou / chargeback -> past_due (a carência corre no gate).
      const { error: updErr } = await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", sub.id);

      if (updErr) return await failRetryable(`erro marcando past_due: ${updErr.message}`);
    }
    // Demais eventos (CREATED, UPDATED, VIEWED...): só espelhamos o payment
    // acima, sem tocar na subscription. Comportamento correto.

    // 4f. SUCESSO -> AGORA sim marcamos "processado" (entregue).
    await markProcessed(supabase, eventId);
    return jsonResponse(200, { processed: true, event: eventType });

  } catch (err) {
    // Exceção inesperada = provavelmente transitória -> RETRY (bounded).
    // Não marcamos processed; o Asaas reenvia. Se for um bug persistente, as
    // tentativas se esgotam, a fila é liberada e a reconciliação (S4) pega.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro inesperado processando webhook:", message);
    return await failRetryable(`unexpected: ${message}`);
  }
});

// Marca o evento como PROCESSADO (entregue). Só é chamado em caminhos de
// sucesso ou terminais. O 'note' é uma observação, não um erro.
async function markProcessed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
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