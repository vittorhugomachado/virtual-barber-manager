# TODO — Pagamentos Asaas: correções antes de produção

> Revisão de vulnerabilidades/inconsistências do fluxo `create-subscription` + `asaas-webhook`.
> Meta: **atender 10 ou 10.000 usuários da mesma forma.**
> Status atual: o *caminho feliz* (assinatura nova, paga na hora, 1 request) funciona.
> Fora disso há furos de **"cliente paga e não recebe acesso"** e de **cobrança injusta**.

**Legenda:** 🔴 bloqueia produção · 🟠 inconsistência de dados/cobrança · 🟡 segurança/hardening · 🔵 escala

---

## 🔴 Crítico — impedem "funcionar igual para todos"

- [ ] **C1 — Criar o portão de acesso (gate).**
  O webhook escreve `current_period_end`/`past_due`, mas **nada lê** isso para bloquear.
  Hoje barbearia `incomplete` ou `past_due` continua inserindo agendamentos/clientes (produto de graça).
  - [ ] Função `is_barbershop_active(p_barbershop_id uuid)` — `security definer`, `stable`, `set search_path = ''`; retorna `now() < current_period_end + grace AND status <> 'canceled'`.
  - [ ] Policies **RLS RESTRICTIVE for insert** em `appointments`, `customers`, `barbers`, `services`.
  - [ ] Decisão: gate só no **INSERT** (atrasado = somente-leitura), **não** no SELECT.
  - [ ] Teste: `current_period_end` no passado → INSERT bloqueado, SELECT ok.
  - Ref.: Fase 3 do `TODO-pagamentos.md`.

- [x] **C2 — Corrigir a idempotência do webhook (perda de evento).**
  Hoje grava o evento **antes** de processar; em falha (corrida `subscription_not_found` ou erro transitório) responde 200 e o Asaas nunca reenvia. Retry futuro bate no guard `23505` e retorna `{duplicate:true}` sem reprocessar → **efeito perdido permanente**.
  - [x] Separar "recebido" de "processado": deduplicar por `processed_at IS NOT NULL`, não pela mera existência da linha.
  - [x] Retornar **500** nos casos retryable (ex.: `subscription_not_found`) **antes** de queimar o `asaas_event_id`.
  - [x] Garantir reprocessamento (ver **S4** — job de reconciliação).
  - Nota: o `PAYMENT_CREATED` (que entrega o `invoiceUrl`, plano B do passo 9) pode chegar **antes** do passo 8 persistir o `asaas_subscription_id` → hoje é descartado.

- [x] **C3 — CORS por env (não travar em `localhost:5173`).**
  As respostas do `create-subscription` devolvem `Access-Control-Allow-Origin: http://localhost:5173`, mas o preflight OPTIONS devolve `*` (inconsistente). Em produção o navegador bloqueia tudo.
  - [x] Usar `ALLOWED_ORIGIN` via env var, **igual** no OPTIONS e no POST.

---

## 🟠 Alto — inconsistências de dados/cobrança

- [x] **H1 — Corrigir a matemática da renovação.**
  Hoje: `newPeriodEnd = addMonths(paymentDate, ciclo)` — quem renova antes de vencer **perde** os dias restantes.
  - [x] Trocar por: `new_end = max(current_period_end, paymentDate) + ciclo`.
  - Ref.: `TODO-pagamentos.md:105` (`current_period_end += interval`).

- [x] **H2 — Eliminar corrida que duplica customer/subscription no Asaas.**
  Dois cliques/retries concorrentes leem `asaas_subscription_id = null` e ambos criam no Asaas; a assinatura órfã continua cobrando.
  - [x] Reivindicar a linha atomicamente antes de chamar o Asaas:
        `update subscriptions set ... where id = ? and asaas_subscription_id is null returning *`.
  - [x] (Complementar) enviar **idempotency key** ao Asaas.

- [x] **H3 — Enviar idempotency key nas chamadas ao Asaas.**
  `createCustomer`/`createSubscription` sem chave: timeout de rede em chamada bem-sucedida vira duplicata no retry.
  - [x] Adicionar o header de idempotência do Asaas em ambas as chamadas.

---

## 🟡 Médio — segurança e hardening

- [ ] **M1 — Proteger/remover rotas públicas de teste.**
  `/teste-asaas` e `/painel` estão públicas (`app-routes.tsx:216-231`) e todo o `ProtectedRoute` está comentado. Hoje **nada** no app está protegido no nível de rota.
  - [ ] Remover (ou gatear) `/teste-asaas` e `/painel` antes de prod.
  - [ ] Reativar o `ProtectedRoute`.
- [ ] **M2 — Comparação de token constant-time** no webhook (hoje `receivedToken !== expectedToken` → timing side-channel).
- [ ] **M3 — Allowlist de IP do Asaas** no webhook (defesa em profundidade). (docs #3)
- [ ] **M4 — Validar `cpf_cnpj`** (11 dígitos CPF / 14 CNPJ) antes de chamar o Asaas. (docs #4)
- [ ] **M5 — Rate limit no `create-subscription`** por `userId` (abuso + custo de criar customers no Asaas). (docs #5)

---

## 🔵 Escala — o que muda entre 10 e 10k

- [ ] **S1 — Confirmar índices.**
  - [ ] Índice **único** em `subscriptions.asaas_subscription_id` (o webhook faz `.eq(...)`).
  - [ ] Conferir únicos em `payments.asaas_payment_id` e `webhook_events.asaas_event_id`.
- [X] **S2 — Sanear `webhook_events`.**
  - [X] Adicionar `received_at timestamptz default now()` (hoje não dá nem para podar por data).
  - [X] Política de retenção/partição + payload enxuto.
- [ ] **S3 — Remover o loop bloqueante de invoice (~2,1s).**
  - [ ] Retornar `invoice_url: null` na hora e confiar no webhook `PAYMENT_CREATED` para entregar a URL. (docs #10)
- [X] **S4 — Job de reconciliação.**
  - [X] Job periódico que compara o estado local com o Asaas (lista pagamentos/assinaturas) e corrige a deriva. Rede de segurança para os eventos perdidos (C2).

---

## ✅ Pré-produção — fora da revisão de código, mas obrigatório

- [ ] **Auditar RLS + GRANTs** de todas as tabelas (lembrete do projeto: "403 num GET = falta de GRANT").
- [ ] **Revisar `_shared/asaas.ts`** — tratamento de erro/timeout e **guarda da API key**.
- [ ] **Fluxo de cancelamento / reembolso / troca de plano** (hoje o webhook só trata `past_due`).
- [ ] **Observabilidade + alertas** — saber quando um pagamento falha silenciosamente (sem isso, C2/S4 não são seguros).
- [ ] **Fiscal (nota fiscal) e LGPD** — guarda de CPF/CNPJ e dados de cobrança.
- [ ] **Sandbox → produção** — trocar credenciais/URL do webhook e **reexecutar todos os testes** no ambiente real.
- [ ] **Soft launch** — 5–10 barbearias reais, dinheiro real pequeno, monitorando diariamente por algumas semanas antes de escalar.

---

## Ordem sugerida

1. **C1** (gate) — é o que efetivamente "liga" a cobrança.
2. **C2** (idempotência) + **H1** (renovação).
3. **C3** (CORS) + **M1** (rotas públicas).
4. **H2, H3, S1, S4**.
5. Restante: **M2–M5, S2, S3** + checklist de pré-produção.