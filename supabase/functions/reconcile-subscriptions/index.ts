/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// O QUE FAZ: rede de segurança do webhook (S4). Relê os eventos que ficaram
// PRESOS na webhook_events (processed_at NULL ou marcados "gave_up" pelo C2) e
// reaplica o efeito — ativando/renovando assinaturas de quem pagou mas não foi
// processado. Não depende de _shared nem da API do Asaas: usa o payload salvo.
//
// SEGURANÇA: header secreto x-reconcile-secret. (Desligue Verify JWT na dashboard.)
// ============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const BATCH_SIZE = 100;
const CONFIRMING_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const FAILING_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_REVERSED",
]);
const CYCLE_MONTHS: Record<string, number> = {
  WEEKLY: 0,
  BIWEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};

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
  // -------- 1. Autenticação por segredo (só o pg_cron pode chamar) --------
  const expected = Deno.env.get("RECONCILE_SECRET");
  const received = req.headers.get("x-reconcile-secret");
  if (!received || !(await safeEqual(received, expected))) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  // -------- 2. Cliente admin (service_role) — inline (sem _shared) --------
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return jsonResponse(500, { error: "missing_env" });
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -------- 3. Carrega os eventos PRESOS (mais antigos primeiro) --------
  // processed_at NULL = nunca terminou | error 'gave_up%' = desistiu após retries
  const { data: stuck, error: loadErr } = await supabase
    .from("webhook_events")
    .select("asaas_event_id, event_type, payload")
    .or("processed_at.is.null,error.like.gave_up*")
    .lt("received_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .order("received_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (loadErr) {
    console.error("Erro carregando eventos presos:", loadErr.message);
    return jsonResponse(500, { error: "db_error_loading_events" });
  }

  const results = { checked: 0, reconciled: 0, skipped: 0, errors: 0 };

  // -------- 4. Reprocessa cada evento preso --------
  for (const ev of stuck ?? []) {
    results.checked++;
    try {
      const body: any = ev.payload;
      const eventType: string = ev.event_type ?? body?.event;
      const payment = body?.payment;

      // Sem objeto de pagamento -> terminal: marca processado e segue.
      if (!payment || typeof payment !== "object") {
        await markProcessed(supabase, ev.asaas_event_id, "no_payment_object");
        results.skipped++;
        continue;
      }

      const asaasSubscriptionId: string | undefined = payment.subscription;
      const externalRef: string | undefined = payment.externalReference;

      // Pagamentos sem assinatura Asaas (buy-pack) só interessam em eventos de
      // confirmação e quando há externalReference (= barbershop_id). Qualquer
      // outro caso sem subscription é terminal. MESMA defesa do webhook — antes
      // o reconcile descartava TODO pagamento de pack (não tinha paridade).
      if (
        !asaasSubscriptionId &&
        (!externalRef || !CONFIRMING_EVENTS.has(eventType))
      ) {
        await markProcessed(
          supabase,
          ev.asaas_event_id,
          "payment_without_subscription",
        );
        results.skipped++;
        continue;
      }

      // Acha a subscription: 1º pelo id do Asaas; senão pelo externalReference.
      const SUB_COLUMNS =
        "id, status, current_period_end, asaas_subscription_id, plans:plan_id ( asaas_cycle )";
      let sub: any = null;
      if (asaasSubscriptionId) {
        const { data } = await supabase
          .from("subscriptions")
          .select(SUB_COLUMNS)
          .eq("asaas_subscription_id", asaasSubscriptionId)
          .maybeSingle();
        sub = data;
      }
      if (!sub && externalRef) {
        const { data } = await supabase
          .from("subscriptions")
          .select(SUB_COLUMNS)
          .eq("barbershop_id", externalRef)
          .maybeSingle();
        sub = data;
        // Backfill do id só para recorrentes (pack não tem subscription_id).
        if (sub && !sub.asaas_subscription_id && asaasSubscriptionId) {
          await supabase
            .from("subscriptions")
            .update({ asaas_subscription_id: asaasSubscriptionId })
            .eq("id", sub.id);
        }
      }

      // Ainda não existe (a corrida ainda não resolveu) -> deixa para a próxima
      // rodada (NÃO marca processado).
      if (!sub) {
        results.skipped++;
        continue;
      }

      // Espelha a cobrança (idempotente por asaas_payment_id).
      await supabase.from("payments").upsert(
        {
          subscription_id: sub.id,
          asaas_payment_id: payment.id,
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

      // Aplica o efeito — a MESMA lógica do webhook.
      if (CONFIRMING_EVENTS.has(eventType)) {
        const cycle: string = sub.plans?.asaas_cycle ?? "MONTHLY";
        const months = CYCLE_MONTHS[cycle] ?? 1;

        // Parcelas 2+ de pack (sem asaas_subscription_id) não estendem o
        // período — já foi definido na compra ou pela 1ª parcela. Igual webhook.
        const installmentNumber: number =
          (payment.installmentNumber as number) ?? 1;
        if (!asaasSubscriptionId && installmentNumber > 1) {
          await markProcessed(
            supabase,
            ev.asaas_event_id,
            "reconciled_pack_installment",
          );
          results.reconciled++;
          continue;
        }

        // Âncora ESTÁVEL na cobrança (dueDate), nunca "now": mesma lógica
        // idempotente do webhook — não soma ciclo duplicado.
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
        const newEnd = current && current > candidate ? current : candidate;

        const { error: updErr } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: newEnd.toISOString(),
          })
          .eq("id", sub.id);
        if (updErr) throw new Error(`erro ativando: ${updErr.message}`); // try/catch trata
      } else if (FAILING_EVENTS.has(eventType)) {
        const { error: updErr } = await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("id", sub.id);
        if (updErr) throw new Error(`erro past_due: ${updErr.message}`);
      }

      await markProcessed(supabase, ev.asaas_event_id, "reconciled_by_job");
      results.reconciled++;
    } catch (e) {
      results.errors++;
      await supabase.from("ops_alerts").insert({
        level: "error",
        source: "reconcile",
        kind: "reconcile_error",
        message: e instanceof Error ? e.message : String(e),
        context: { eventId: ev.asaas_event_id },
      });
      console.error(
        `Erro reconciliando ${ev.asaas_event_id}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log("Reconciliação concluída:", results);
  return jsonResponse(200, { ok: true, batch: stuck?.length ?? 0, ...results });
});

// Marca o evento como processado (entregue). 'note' é observação, não erro.
async function markProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  note?: string,
) {
  await supabase
    .from("webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error: note ? `note: ${note}` : null,
    })
    .eq("asaas_event_id", eventId);
}
