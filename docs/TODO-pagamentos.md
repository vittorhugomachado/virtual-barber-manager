# TODO — Sistema de Pagamentos / Mensalidades

Modelo: **3 tabelas** (catálogo / estado / histórico) + **gate por data** + **Edge Functions**.
Princípio que amarra tudo:

> **`current_period_end` é a única verdade do acesso, e SÓ o `service_role` escreve nele.**
> O gate (`is_barbershop_active`) só olha a data — não importa se foi Pix manual ou
> cartão recorrente que a estendeu. UI decide o que mostrar; RLS decide o que pode.

Suporta: **pré-pago** (Pix/boleto) **e recorrente** (cartão), e compra de plano
**mensal / trimestral / semestral / anual** com desconto.

---

## Fase 0 — Decisões antes de codar

- [ ] Escolher provedor: **Asaas** ou **Mercado Pago** (ambos: cartão recorrente + Pix/boleto num lugar só).
- [ ] Definir política de preço para assinaturas de cartão JÁ ativas:
  - [ ] **(recomendado)** preço travado: quem assinou mantém o valor até cancelar.
  - [ ] ou reajustar via API do provedor (exige avisar o cliente — lei).
- [ ] Definir `grace_period_days` (sugestão: 5).
- [ ] Definir os planos e preços iniciais (ex.: mensal R$99, trimestral 10% off, anual 20% off).

---

## Fase 1 — Banco: tabelas (catálogo / estado / histórico)

- [ ] **`plans`** (catálogo — fonte única de preço)
  - colunas: `id text pk`, `name`, `interval_months int`, `price_cents int`, `is_active bool`
  - 1 linha por intervalo (monthly/quarterly/semiannual/annual)
- [ ] **`subscriptions`** (estado — 1 por barbearia)
  - `barbershop_id pk fk`, `plan_id fk`, `status` (trialing|active|canceled)
  - `current_period_end timestamptz` ← **CAMPO SAGRADO**
  - `grace_period_days int`, `updated_at`
  - recorrência: `payment_type` (prepaid|recurring), `provider`,
    `provider_subscription_id`, `cancel_at_period_end bool`
- [ ] **`payments`** (histórico imutável — snapshot)
  - `id`, `barbershop_id fk`, `plan_id fk`
  - `amount_cents int` e `interval_months int` → **SNAPSHOT** (não referenciar `plans.price`)
  - `status` (pending|paid|failed|refunded), `provider`, `provider_payment_id`,
    `paid_at`, `created_at`

---

## Fase 2 — Banco: GRANTS e RLS (núcleo de segurança)

> Lição já aprendida neste projeto: **403 num GET = falta de GRANT, não RLS.**
> Conferir grants para `authenticated` E `service_role` em TODA tabela nova.

- [ ] `enable row level security` nas 3 tabelas.
- [ ] **GRANTs:**
  - [ ] `service_role`: `grant all on plans, subscriptions, payments to service_role`
  - [ ] `authenticated`: `grant select on plans to authenticated` (catálogo é leitura pública p/ logados)
  - [ ] `authenticated`: `grant select on subscriptions to authenticated` (UI lê status)
  - [ ] `authenticated`: `grant select on payments to authenticated` (dono vê histórico)
  - [ ] **NÃO** conceder INSERT/UPDATE/DELETE de `subscriptions`/`payments` a `authenticated`.
- [ ] **Policies `subscriptions`:**
  - [ ] owner faz **SELECT** da própria (`owner check`) — para a UI.
  - [ ] **SEM** policy de INSERT/UPDATE p/ cliente → só `service_role` escreve `current_period_end`. ⬅️ crítico
- [ ] **Policies `payments`:**
  - [ ] owner faz **SELECT** dos próprios pagamentos.
  - [ ] **SEM** INSERT/UPDATE/DELETE p/ cliente.
- [ ] **Policies `plans`:**
  - [ ] SELECT para `authenticated` (e `anon` se a landing pública mostrar preços).
  - [ ] escrita só `service_role`.

---

## Fase 3 — Banco: o portão de acesso (gate)

- [ ] Função `is_barbershop_active(p_barbershop_id uuid)`:
  - `security definer`, `stable`, `set search_path = ''`
  - retorna `now() < current_period_end + grace` AND `status <> 'canceled'`
- [ ] `grant execute` da função para `authenticated` (UI pode pré-checar).
- [ ] **Policies RESTRICTIVE de INSERT** (fazem `AND` com as policies existentes, sem reescrevê-las):
  - [ ] `appointments` — `as restrictive for insert with check (is_barbershop_active(barbershop_id))`
  - [ ] `customers` — idem
  - [ ] `barbers` — idem
  - [ ] `services` — idem (decidir se entra)
- [ ] **Decisão:** gate só em INSERT (atrasado = somente-leitura). NÃO gatear SELECT.
- [ ] Testar: simular `current_period_end` no passado → INSERT bloqueado, SELECT ok.

---

## Fase 4 — Edge Function: iniciar pagamento/assinatura

- [ ] `create-checkout` (ou nome do provedor):
  - [ ] valida JWT do owner (identidade do token, nunca do body) — mesmo padrão do `create-member`.
  - [ ] confirma ownership do `barbershop_id` (via service_role).
  - [ ] recebe `plan_id` + `payment_type` (prepaid|recurring).
  - [ ] cria a cobrança/assinatura no provedor a partir do `plans` (preço server-side, nunca do cliente).
  - [ ] retorna URL de checkout hospedado (ou inicia tokenização).
  - [ ] insere `payments(status='pending')`.
- [ ] **Nunca** receber número de cartão no backend (checkout hospedado ou token).

---

## Fase 5 — Edge Function: webhook (o coração)

- [ ] `payment-webhook`:
  - [ ] **validar a assinatura/secret do webhook** do provedor (rejeitar forjado). ⬅️ crítico
  - [ ] idempotência: ignorar evento repetido (usar `provider_payment_id`).
  - [ ] roda como `service_role`.
- [ ] Tratar eventos (todos terminam em "estende a data"):
  - [ ] `payment.paid` / `invoice.paid` → `payments(paid)` + `current_period_end += interval_months`
  - [ ] `subscription.authorized` → `status='active'`, `payment_type='recurring'`, salva `provider_subscription_id`
  - [ ] `payment.failed` → registra falha; **não bloquear na hora** (graça + dunning do provedor)
  - [ ] `subscription.canceled` → `cancel_at_period_end=true` (roda até o fim do período pago)
- [ ] Cálculo do novo `current_period_end` **sempre server-side** (a partir do `plans.interval_months`).

---

## Fase 6 — Front: UI

- [ ] Tela de planos (lê `plans`): mostra mensal/trimestral/semestral/anual + % de economia.
- [ ] Botão assinar → chama `create-checkout` → redireciona pro checkout.
- [ ] Banner de status (lê `subscriptions.current_period_end`, calcula no cliente):
  - [ ] ≤ 7 dias → 🟡 "vence em X dias"
  - [ ] passou, dentro da graça → 🟠 "atrasado, regularize" (ainda escreve)
  - [ ] passou da graça → 🔴 "somente leitura" (RLS já bloqueia)
- [ ] Tela "minha assinatura": plano atual, histórico (`payments`), cancelar (se recorrente).
- [ ] Lembrar: banner é só UX; **quem segura é a RLS**.

---

## Fase 7 — Checklist de segurança (revisar antes de prod)

- [ ] `current_period_end` NÃO tem policy de escrita p/ cliente (só service_role). ✅ o item mais importante
- [ ] Webhook valida assinatura/secret do provedor.
- [ ] Webhook é idempotente (não credita 2x o mesmo pagamento).
- [ ] Preço/period sempre vêm do `plans` no servidor, nunca do body do cliente.
- [ ] Nenhum dado de cartão toca o backend (PCI fora de escopo).
- [ ] `service_role key` só em Edge Functions / secrets, nunca no front.
- [ ] `payments` é só-append (sem UPDATE/DELETE p/ cliente) — auditoria íntegra.
- [ ] Grants conferidos p/ `authenticated` e `service_role` nas 3 tabelas.

---

## Fase 8 — Testes ponta a ponta

- [ ] Comprar plano anual (pré-pago Pix) → webhook estende 12 meses → INSERT liberado.
- [ ] Assinatura recorrente cartão → 1ª cobrança estende → renovação automática estende de novo.
- [ ] Simular atraso (data no passado) → INSERT bloqueado, SELECT ok, banner 🔴.
- [ ] Simular falha de cartão → sem extensão → acesso expira após a graça.
- [ ] Mudar `plans.price_cents` → histórico (`payments`) intacto; novas compras no preço novo.
- [ ] Cancelar assinatura → roda até `current_period_end`, depois não renova.

---

### Notas de design (referência)

- **Único ponto de mudança de preço:** `plans.price_cents`. `payments` guarda snapshot →
  mudar preço não reescreve histórico nem quem já pagou.
- **Pré-pago vs recorrente:** mudam só os _eventos_ tratados no webhook; o gate, o RLS,
  a UI e o `payments` permanecem idênticos.
- **Preço de assinatura de cartão ativa:** não muda sozinho ao editar `plans` — decisão da Fase 0.
