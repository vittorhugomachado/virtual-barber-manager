// payment-logic.test.mjs
// Testes de LÓGICA PURA do fluxo de pagamento — sem DB, sem rede.
// Replica as funções de data/desconto das edge functions e valida os
// cenários críticos. Rodar: node supabase/tests/payment-logic.test.mjs
//
// Cobre:
//   - Anti contagem-dupla (âncora estável no dueDate + MAX) — o bug original.
//   - Idempotência ao reprocessar o MESMO pagamento.
//   - Renovação estende exatamente 1 ciclo (não 2).
//   - #6 estorno/chargeback encurta para now+2d (nunca estende).
//   - computeNewPeriodEnd preserva dias restantes / reinicia se expirado.
//   - applyCouponDiscount (percentual, fixo, piso de R$1).

// ---------- funções replicadas das edge functions ----------
function addMonths(from, months) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

// webhook/reconcile: efeito de PAYMENT_CONFIRMED
function confirmNewPeriodEnd({
  dueDate,
  paymentDate,
  currentPeriodEnd,
  months,
}) {
  const anchor = dueDate
    ? new Date(dueDate)
    : paymentDate
      ? new Date(paymentDate)
      : new Date();
  const candidate = addMonths(anchor, months);
  const current = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  return current && current > candidate ? current : candidate;
}

// webhook/reconcile: efeito de estorno/chargeback (#6)
const REVOKE_GRACE_DAYS = 2;
function revokeNewPeriodEnd(currentPeriodEnd, nowMs) {
  const graceEnd = new Date(nowMs + REVOKE_GRACE_DAYS * 86_400_000);
  const current = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  return current && current < graceEnd ? current : graceEnd;
}

// _shared/asaas.ts
function computeNewPeriodEnd(currentPeriodEnd, months, nowMs) {
  const now = new Date(nowMs);
  const anchor =
    currentPeriodEnd && new Date(currentPeriodEnd) > now
      ? new Date(currentPeriodEnd)
      : now;
  return addMonths(anchor, months);
}

function applyCouponDiscount(priceCents, coupon) {
  if (coupon.discount_type === "percentage") {
    return Math.max(
      100,
      Math.round(priceCents * (1 - coupon.discount_value / 100)),
    );
  }
  return Math.max(100, priceCents - Math.round(coupon.discount_value * 100));
}

// ---------- mini harness ----------
let passed = 0;
let failed = 0;
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ""}`);
  }
}
const iso = d => new Date(d).toISOString();
const DAY = 86_400_000;

console.log("\n== #3/H1: anti contagem-dupla e idempotência ==");
{
  // create-monthly ativou na hora p/ o pagamento de hoje:
  const dueDate = "2026-06-20";
  const currentAfterCreate = "2026-07-20T14:00:00.000Z"; // computeNewPeriodEnd(null,1) ~ now+1mo
  // webhook chega para o MESMO pagamento:
  const r = confirmNewPeriodEnd({
    dueDate,
    currentPeriodEnd: currentAfterCreate,
    months: 1,
  });
  check(
    "webhook do mesmo pagamento NÃO soma outro mês",
    iso(r) === iso(currentAfterCreate),
    `got ${iso(r)}`,
  );

  // reprocessar o MESMO evento de novo (idempotente):
  const r2 = confirmNewPeriodEnd({
    dueDate,
    currentPeriodEnd: iso(r),
    months: 1,
  });
  check(
    "reprocesso do mesmo evento é idempotente",
    iso(r2) === iso(r),
    `got ${iso(r2)}`,
  );
}

console.log("\n== Renovação mensal estende exatamente 1 ciclo ==");
{
  const current = "2026-07-20T00:00:00.000Z"; // fim do período atual
  const nextDueDate = "2026-07-20"; // cobrança do próximo ciclo
  const r = confirmNewPeriodEnd({
    dueDate: nextDueDate,
    currentPeriodEnd: current,
    months: 1,
  });
  check(
    "renovação vai para 2026-08-20 (não 09-20)",
    iso(r) === iso("2026-08-20T00:00:00.000Z"),
    `got ${iso(r)}`,
  );
}

console.log("\n== Pacote anual: âncora estável evita dobrar ==");
{
  const dueDate = "2026-06-20";
  const currentAfterBuyPack = "2027-06-20T10:00:00.000Z"; // +12m setado na compra
  const r = confirmNewPeriodEnd({
    dueDate,
    currentPeriodEnd: currentAfterBuyPack,
    months: 12,
  });
  check(
    "webhook não soma +12m de novo",
    iso(r) === iso(currentAfterBuyPack),
    `got ${iso(r)}`,
  );
}

console.log("\n== #6: estorno/chargeback encurta para now+2d ==");
{
  const now = Date.parse("2026-06-20T12:00:00.000Z");
  // período longe no futuro -> encurta para +2d
  const r1 = revokeNewPeriodEnd("2027-01-01T00:00:00.000Z", now);
  check(
    "período distante é encurtado p/ now+2d",
    iso(r1) === iso(now + 2 * DAY),
    `got ${iso(r1)}`,
  );

  // já falta menos que a carência -> NÃO estende (mantém o atual)
  const near = iso(now + 1 * DAY);
  const r2 = revokeNewPeriodEnd(near, now);
  check(
    "não estende quando falta menos que 2d",
    iso(r2) === near,
    `got ${iso(r2)}`,
  );

  // sem período -> vira now+2d
  const r3 = revokeNewPeriodEnd(null, now);
  check(
    "sem período vira now+2d",
    iso(r3) === iso(now + 2 * DAY),
    `got ${iso(r3)}`,
  );

  // overdue NÃO passa por aqui (sanity): a função só é chamada p/ REVOKING.
  check("carência é de 2 dias", REVOKE_GRACE_DAYS === 2);
}

console.log("\n== computeNewPeriodEnd: preserva dias / reinicia ==");
{
  const now = Date.parse("2026-06-20T12:00:00.000Z");
  // 5 dias restantes + 12 meses -> preserva os 5 dias
  const current = iso(now + 5 * DAY);
  const r = computeNewPeriodEnd(current, 12, now);
  check(
    "renovação antecipada preserva dias restantes",
    r > new Date(now + 12 * 30 * DAY),
    `got ${iso(r)}`,
  );
  check(
    "ancora no fim atual (não no now)",
    iso(r) === iso(addMonths(new Date(current), 12)),
    `got ${iso(r)}`,
  );

  // expirado -> começa do now
  const expired = iso(now - 10 * DAY);
  const r2 = computeNewPeriodEnd(expired, 12, now);
  check(
    "período expirado reinicia do now",
    iso(r2) === iso(addMonths(new Date(now), 12)),
    `got ${iso(r2)}`,
  );
}

console.log("\n== applyCouponDiscount ==");
{
  check(
    "percentual 20% de 5000 = 4000",
    applyCouponDiscount(5000, {
      discount_type: "percentage",
      discount_value: 20,
    }) === 4000,
  );
  check(
    "fixo R$30 de 5000 = 2000",
    applyCouponDiscount(5000, {
      discount_type: "fixed",
      discount_value: 30,
    }) === 2000,
  );
  check(
    "piso de R$1 (100c) quando desconto > preço",
    applyCouponDiscount(5000, {
      discount_type: "fixed",
      discount_value: 100,
    }) === 100,
  );
  check(
    "percentual 100% cai no piso de 100c",
    applyCouponDiscount(5000, {
      discount_type: "percentage",
      discount_value: 100,
    }) === 100,
  );
}

console.log("\n== #6 cobertura: pagamento de PACOTE (sem assinatura) ==");
{
  const CONFIRMING = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
  const REVOKING = new Set([
    "PAYMENT_REFUNDED",
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_REVERSED",
  ]);
  // true = webhook/reconcile PROCESSA; false = ignora (payment_without_subscription)
  const processesNoSub = (eventType, externalRef, asaasSubscriptionId) => {
    const skip =
      !asaasSubscriptionId &&
      (!externalRef ||
        (!CONFIRMING.has(eventType) && !REVOKING.has(eventType)));
    return !skip;
  };
  const ref = "barbershop-uuid";
  check(
    "pack CONFIRMADO (com ref) é processado",
    processesNoSub("PAYMENT_CONFIRMED", ref, undefined) === true,
  );
  check(
    "pack ESTORNADO (com ref) é processado [fix]",
    processesNoSub("PAYMENT_REFUNDED", ref, undefined) === true,
  );
  check(
    "pack CHARGEBACK (com ref) é processado [fix]",
    processesNoSub("PAYMENT_CHARGEBACK_REQUESTED", ref, undefined) === true,
  );
  check(
    "pack OVERDUE (com ref) é ignorado",
    processesNoSub("PAYMENT_OVERDUE", ref, undefined) === false,
  );
  check(
    "pack sem externalReference é ignorado",
    processesNoSub("PAYMENT_CONFIRMED", undefined, undefined) === false,
  );
  check(
    "recorrente (com asaas_subscription_id) sempre processa",
    processesNoSub("PAYMENT_REFUNDED", undefined, "sub_123") === true,
  );
}

console.log(
  `\n================  ${passed} passed, ${failed} failed  ================\n`,
);
process.exit(failed === 0 ? 0 : 1);
