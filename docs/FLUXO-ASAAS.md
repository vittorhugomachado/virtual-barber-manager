# Fluxo de Billing — Virtual Barber + Asaas

## Visão geral

O billing é composto por três partes independentes que se encadeiam:

| Parte                     | Onde roda           | O que faz                                             |
| ------------------------- | ------------------- | ----------------------------------------------------- |
| **Trigger de signup**     | Postgres (Supabase) | Cria barbearia + linha `trialing` em `subscriptions`  |
| **`create-subscription`** | Edge Function       | Converte o trial em assinatura paga no Asaas          |
| **`asaas-webhook`**       | Edge Function       | Escuta confirmações do Asaas e libera/bloqueia acesso |

---

## 1. Signup — trigger cria o trial

```mermaid
flowchart TD
    A([Dono faz signUp\ncom role=barbershop]) --> B{metadata\nbarbershop_name\nexiste?}
    B -- Não --> Z([Trigger não age\nreturn new])
    B -- Sim --> C{barbershop já\nexiste para\neste owner_id?}
    C -- Sim --> Z
    C -- Não --> D{telefone já\ncadastrado?}
    D -- Sim --> ERR([RAISE EXCEPTION\nphone_already_exists\nSignUp falha])
    D -- Não --> E[Gera UUID da barbearia\nCalcula slug único]
    E --> F[INSERT profiles\nrole=barbershop]
    F --> G[INSERT barbershops\nid, owner_id, name,\nslug, email, phone]
    G --> H[INSERT store_style\nestilo default]
    H --> I[Busca plan com\nproduct_code=pro\norder by sort_order\nnull se não encontrar]
    I --> K[INSERT subscriptions\nbarbershop_id, plan_id\nstatus=trialing\ntrial_ends_at=now+30d]
    K --> L([Signup concluído])
```

> **Estado resultante:** `subscriptions.status = trialing`, `plan_id` preenchido com o plano `pro` de menor `sort_order` (ou `null` se nenhum plano ativo existir), sem nenhum ID do Asaas.

---

## 2. create-subscription — conversão trial → pago

Chamada pelo dono logado no manager quando escolhe o plano e clica em assinar.

```mermaid
flowchart TD
    START([Front envia POST\nbarbershop_id, plan_id\nbilling_type, cpf_cnpj]) --> AUTH{Authorization\nheader presente?}
    AUTH -- Não --> E401([401 missing_authorization])
    AUTH -- Sim --> VERIFY[Valida JWT via\nuserClient.auth.getUser]
    VERIFY --> VALID{JWT válido?}
    VALID -- Não --> E401B([401 invalid_token])
    VALID -- Sim --> PARSE[Parse body]
    PARSE --> REQCHECK{barbershop_id\ne plan_id\npresentes?}
    REQCHECK -- Não --> E400([400 missing_barbershop_id_or_plan_id])
    REQCHECK -- Sim --> BILLCHECK{billing_type\nválido?}
    BILLCHECK -- Não --> E400B([400 invalid_billing_type])
    BILLCHECK -- Sim --> CPFCHECK{cpf_cnpj\npresente?}
    CPFCHECK -- Não --> E400C([400 missing_cpf_cnpj])
    CPFCHECK -- Sim --> OWNCHECK[Busca barbershop\npor barbershop_id]
    OWNCHECK --> OWNED{shop existe\ne owner_id\n= userId?}
    OWNED -- Não --> E403([403 not_barbershop_owner])
    OWNED -- Sim --> PLANDB[Busca plan\nno banco]
    PLANDB --> PLANOK{plano existe\ne is_active?}
    PLANOK -- Não --> E400D([400 invalid_or_inactive_plan])
    PLANOK -- Sim --> SUBDB[Busca subscription\npor barbershop_id]
    SUBDB --> SUBEX{linha existe\nno banco?}
    SUBEX -- Não --> E409([409 no_subscription_row])
    SUBEX -- Sim --> HASASAAS{asaas_subscription_id\njá preenchido?}
    HASASAAS -- Sim --> E409B([409 subscription_already_exists])
    HASASAAS -- Não --> CUSCREATE{asaas_customer_id\njá existe?}
    CUSCREATE -- Não --> NEWCUS[POST /customers\nno Asaas\ncria cus_xxx]
    NEWCUS --> SAVECUS[UPDATE subscriptions\nasaas_customer_id=cus_xxx]
    CUSCREATE -- Sim --> SUBCREATE
    SAVECUS --> SUBCREATE[POST /subscriptions\nno Asaas\ncria sub_xxx]
    SUBCREATE --> SAVEIDS[UPDATE subscriptions\nplan_id, asaas_subscription_id\nstatus=incomplete]
    SAVEIDS --> GETINV[GET /subscriptions/sub_xxx/payments\naté 4 tentativas com 700ms]
    GETINV --> INVOK{invoiceUrl\nencontrado?}
    INVOK -- Sim --> R200([200 ok\nasaas_subscription_id\ninvoice_url])
    INVOK -- Não --> R200N([200 ok\nasaas_subscription_id\ninvoice_url=null])
```

> **Estado resultante:** `subscriptions.status = incomplete`, `asaas_subscription_id` preenchido.  
> Acesso **NÃO** liberado aqui. Quem libera é o webhook.

---

## 3. asaas-webhook — confirma pagamento e controla acesso

```mermaid
flowchart TD
    POST([Asaas envia POST]) --> TOKEN{asaas-access-token\n= ASAAS_WEBHOOK_TOKEN?}
    TOKEN -- Não --> E401([401 unauthorized])
    TOKEN -- Sim --> PARSE[Parse body\neventId, eventType, payment]
    PARSE --> HASID{eventId e\neventType\npresentes?}
    HASID -- Não --> IGN([200 ignored])
    HASID -- Sim --> IDEM[INSERT webhook_events\nasaas_event_id UNIQUE]
    IDEM --> DUP{duplicate\n23505?}
    DUP -- Sim --> R200DUP([200 duplicate=true\nidempotente])
    DUP -- Não --> HASPAY{payment\nobject existe?}
    HASPAY -- Não --> MARK([200 no_payment_object])
    HASPAY -- Sim --> HASSUB{payment.subscription\nexiste?}
    HASSUB -- Não --> MARK2([200 not_a_subscription_payment])
    HASSUB -- Sim --> LOCSUB[Busca subscription\npor asaas_subscription_id]
    LOCSUB --> SUBFOUND{encontrada\nno banco?}
    SUBFOUND -- Não --> MARK3([200 subscription_not_found\nAsaas vai reenviar])
    SUBFOUND -- Sim --> UPSERT[UPSERT payments\namount, billing_type,\nstatus, due_date,\npaid_at, invoice_url]
    UPSERT --> EVTYPE{eventType}
    EVTYPE -- PAYMENT_CONFIRMED\nou PAYMENT_RECEIVED --> ACTIVATE[UPDATE subscriptions\nstatus=active\ncurrent_period_end=\npaymentDate + ciclo]
    EVTYPE -- PAYMENT_OVERDUE\nREFUNDED\nCHARGEBACK\nREVERSED --> PASTDUE[UPDATE subscriptions\nstatus=past_due]
    EVTYPE -- outros eventos --> NOOP[Só upsert payment\nsem tocar subscription]
    ACTIVATE --> DONE([200 processed])
    PASTDUE --> DONE
    NOOP --> DONE
```

> **Estado resultante após pagamento confirmado:** `subscriptions.status = active`, `current_period_end` calculado.

---

## 4. Máquina de estados de `subscriptions.status`

```mermaid
stateDiagram-v2
    [*] --> trialing : Trigger de signup\n(função unificada: profiles +\nbarbershops + store_style +\nsubscriptions)
    trialing --> incomplete : create-subscription\n(Asaas sub criada,\nainda não paga)
    incomplete --> active : PAYMENT_CONFIRMED\nou PAYMENT_RECEIVED
    active --> active : Renovação paga\n(PAYMENT_CONFIRMED)
    active --> past_due : PAYMENT_OVERDUE\nREFUNDED\nCHARGEBACK
    past_due --> active : Pagamento regularizado\n(PAYMENT_CONFIRMED)
```

---

## 5. Vulnerabilidades e melhorias identificadas

### 🔴 Crítico

| #   | Onde                                   | Problema                                                                                                             | Correção                                                                                |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `create-subscription` response headers | CORS hardcoded `http://localhost:5173` — vai quebrar em produção                                                     | Usar env var `ALLOWED_ORIGIN` ou `*` controlado                                         |
| 2   | ~~Trigger de signup~~                  | ~~Se não existir nenhum plano `pro` ativo no banco, o signup inteiro falha com exception — bloqueia novos clientes~~ | ✅ **Resolvido** — `plan_id` agora é nullable; signup nunca falha por ausência de plano |

### 🟠 Segurança

| #   | Onde                  | Problema                                                                                                 | Correção                                                                                                  |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 3   | `asaas-webhook`       | Só valida o token no header, sem IP allowlist                                                            | Adicionar verificação do IP de origem do Asaas (range publicado na doc deles) como defesa em profundidade |
| 4   | `create-subscription` | `cpf_cnpj` é aceito sem nenhuma validação de formato/tamanho — erro chega só no Asaas                    | Validar 11 dígitos (CPF) ou 14 (CNPJ) antes de chamar o Asaas                                             |
| 5   | `create-subscription` | Sem rate limiting — mesmo usuário pode criar N customers no Asaas se apagar `asaas_customer_id` no banco | Adicionar rate limit por `userId` na edge function                                                        |

### 🟡 Integridade de dados

| #   | Onde                  | Problema                                                                                                                                                                                  | Correção                                                                                                                                     |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | `create-subscription` | Se a função criar o customer no Asaas mas crashar antes do `UPDATE asaas_customer_id`, o próximo retry cria um segundo customer (`cus_xxx` diferente) — os dois ficam pendurados no Asaas | Salvar `asaas_customer_id` antes de criar a subscription, com retry-safe (já quase feito, mas o crash entre criar e salvar ainda é possível) |
| 7   | `create-subscription` | `nextDueDate: dueDateInDays(0)` — 1ª cobrança é **hoje**, sem carência                                                                                                                    | Usar `dueDateInDays(1)` ou conforme política comercial                                                                                       |
| 8   | `asaas-webhook`       | `subscription_not_found` responde 200 e não agenda retry — se o webhook chegar antes do `create-subscription` persistir o ID no banco, o evento é perdido                                 | Responder 500 nesse caso específico para o Asaas reenviar, ou usar uma fila de reprocessamento                                               |

### 🟢 Melhorias pontuais

| #   | Onde                  | Sugestão                                                                                                                                                                                              |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 9   | `create-subscription` | Passar `email` do shop para `createCustomer` — melhora rastreamento no painel do Asaas                                                                                                                |
| 10  | `create-subscription` | O loop de 4× buscando `invoiceUrl` pode atrasar a resposta em até ~2s — retornar `invoice_url: null` na 1ª tentativa e deixar o webhook `PAYMENT_CREATED` entregar a URL é mais robusto               |
| 11  | `asaas-webhook`       | O campo `error` da tabela `webhook_events` está sendo usado tanto para erros reais quanto para notas (`note: subscription_not_found_yet`) — criar coluna `note` separada evita confusão em dashboards |
| 12  | Trigger signup        | `product_code = 'pro'` está hardcoded no trigger — se o código do produto mudar no banco, o trial cria subscription com `plan_id = null` silenciosamente                                              | Usar uma constante ou tabela de configuração |
