// reconcile-subscriptions/index.ts
// ============================================================================
// O QUE ESTE CÓDIGO FAZ (Job S4 — reconciliação)
// ----------------------------------------------------------------------------
// É a REDE DE SEGURANÇA do webhook. Roda de tempos em tempos (via pg_cron) e
// conserta assinaturas que ficaram fora de sincronia — tipicamente quando um
// evento do Asaas foi perdido ou "gave_up" (ver C2).
//
// PRINCÍPIO: não confiamos em eventos antigos. Perguntamos ao ASAAS (fonte da
// verdade) quais cobranças a assinatura tem; se o Asaas mostra pagamento
// confirmado que cobre HOJE e o nosso banco não reflete isso, aplicamos o MESMO
// efeito que o webhook aplicaria (status=active + current_period_end).
//
// SEGURANÇA: protegido por um header secreto (x-reconcile-secret). Deploy com
// --no-verify-jwt. Toda escrita roda com service_role.
//
// ESCALA: processa um LOTE por execução (BATCH_SIZE), os mais antigos primeiro,
// e só olha assinaturas candidatas (incomplete/past_due) — não varre as 10k.
// ============================================================================

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { listSubscriptionPayments } from "../_shared/asaas.ts";

// Quantas assinaturas conferimos por execução. Mantém o job rápido e barato.
const BATCH_SIZE = 100;

// Status de cobrança no Asaas que contam como "pago".
const CONFIRMED_PAYMENT_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
]);

// Ciclo do Asaas -> meses a avançar (igual ao webhook).
const CYCLE_MONTHS: Record<string, number> = {
  WEEKLY: 0,
  BIWEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUALLY: 6,
  YEARLY: 12,
};

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
  // ========================================================================
  // PASSO 1 — Autenticação por segredo (só o pg_cron pode chamar).
  // ========================================================================
  const expected = Deno.env.get("RECONCILE_SECRET");
  const received = req.headers.get("x-reconcile-secret");
  if (!expected) {
    console.error("RECONCILE_SECRET não configurado.");
    return jsonResponse(500, { error: "server_misconfigured" });
  }
  if (received !== expected) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const supabase = getSupabaseAdmin();
  const results = { checked: 0, reconciled: 0, errors: 0 };

  // ========================================================================
  // PASSO 2 — Carrega o LOTE de candidatas: assinaturas que TÊM id do Asaas e
  // estão paradas (incomplete = nunca ativou / past_due = falhou). São essas
  // que um evento perdido deixa "presas". Mais antigas primeiro.
  // ========================================================================
  const { data: candidates, error: loadErr } = await supabase
    .from("subscriptions")
    .select(
      "id, status, current_period_end, asaas_subscription_id, plans:plan_id ( asaas_cycle )",
    )
    .not("asaas_subscription_id", "is", null)
    .in("status", ["incomplete", "past_due"])
    .order("updated_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (loadErr) {
    console.error("Erro carregando candidatas:", loadErr.message);
    return jsonResponse(500, { error: "db_error_loading_candidates" });
  }

  // ========================================================================
  // PASSO 3 — Para cada candidata, pergunta ao Asaas e conserta se necessário.
  // ========================================================================
  for (const sub of candidates ?? []) {
    try {
      const cycle: string = sub.plans?.asaas_cycle ?? "MONTHLY";
      const months = CYCLE_MONTHS[cycle] ?? 1;

      // 3a. Fonte da verdade: as cobranças desta assinatura no Asaas.
      const resp = await listSubscriptionPayments(sub.asaas_subscription_id);
      const payments: any[] = resp?.data ?? [];

      // 3b. Pega a cobrança PAGA mais recente.
      const confirmed = payments
        .filter(p => CONFIRMED_PAYMENT_STATUSES.has(p.status))
        .sort((a, b) => {
          const da = new Date(a.paymentDate ?? a.dueDate ?? 0).getTime();
          const db = new Date(b.paymentDate ?? b.dueDate ?? 0).getTime();
          return db - da; // mais recente primeiro
        });
      const latest = confirmed[0];

      // Sem pagamento confirmado no Asaas -> estar parada está CORRETO. Pula.
      if (!latest) {
        results.checked++;
        continue;
      }

      // 3c. Qual período esse pagamento deveria garantir.
      const base = latest.paymentDate
        ? new Date(latest.paymentDate)
        : new Date();
      const expectedPeriodEnd = addMonths(base, months);

      // *** CORREÇÃO IMPORTANTE ***
      // Só reativamos se o último pagamento confirmado AINDA cobre hoje. Se ele
      // já expirou, a assinatura está past_due de verdade -> deixamos como está
      // (senão reativaríamos com base num pagamento velho).
      const coversNow = expectedPeriodEnd.getTime() > Date.now();
      if (!coversNow) {
        results.checked++;
        continue;
      }

      // 3d. Há deriva? (não está active, ou o nosso período está aquém do real)
      const localEnd = sub.current_period_end
        ? new Date(sub.current_period_end)
        : null;
      const drift =
        sub.status !== "active" ||
        !localEnd ||
        localEnd.getTime() < expectedPeriodEnd.getTime();

      if (!drift) {
        results.checked++;
        continue;
      }

      // 3e. Espelha a cobrança (idempotente por asaas_payment_id).
      await supabase.from("payments").upsert(
        {
          subscription_id: sub.id,
          asaas_payment_id: latest.id,
          amount_cents: toCents(latest.value),
          billing_type: latest.billingType ?? null,
          status: latest.status,
          due_date: latest.dueDate ?? null,
          paid_at: latest.paymentDate
            ? new Date(latest.paymentDate).toISOString()
            : null,
          invoice_url: latest.invoiceUrl ?? latest.bankSlipUrl ?? null,
        },
        { onConflict: "asaas_payment_id" },
      );

      // 3f. Corrige a assinatura — o MESMO efeito do webhook.
      const { error: updErr } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          current_period_end: expectedPeriodEnd.toISOString(),
        })
        .eq("id", sub.id);

      if (updErr) throw new Error(updErr.message);

      // 3g. Best-effort: marca eventos pendentes/gave_up desta assinatura como
      // reconciliados (limpa o "lixo" da webhook_events). Se o filtro JSON
      // falhar em alguma versão do PostgREST, é só cosmético — ignoramos o erro.
      await supabase
        .from("webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          error: "note: reconciled_by_job",
        })
        .is("processed_at", null)
        .eq("payload->payment->>subscription", sub.asaas_subscription_id);

      results.reconciled++;
      console.log(
        `Reconciliada ${sub.id} -> active até ${expectedPeriodEnd.toISOString()}`,
      );
    } catch (e) {
      // Um erro numa assinatura NÃO derruba o lote — segue para a próxima.
      results.errors++;
      console.error(
        `Erro reconciliando ${sub.id}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // ========================================================================
  // PASSO 4 — Resumo (aparece nos logs e na resposta do pg_cron).
  // ========================================================================
  console.log("Reconciliação concluída:", results);
  return jsonResponse(200, {
    ok: true,
    batch: candidates?.length ?? 0,
    ...results,
  });
});
