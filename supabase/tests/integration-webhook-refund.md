# Teste de integração — #6 estorno/chargeback revoga acesso

Valida ponta-a-ponta que um evento de **estorno** no `asaas-webhook` (já deployado)
marca a assinatura como `past_due` e **encurta** `current_period_end` para ~`now + 2 dias`.

> ⚠️ Use uma **barbearia de teste** (ex.: a sua própria). O passo 4 restaura o estado.
> Pré-requisitos: o `ASAAS_WEBHOOK_TOKEN` e o `barbershop_id` de teste.

Project ref: `fjfrybzaeghouslsyhgl` · URL: `https://fjfrybzaeghouslsyhgl.supabase.co/functions/v1/asaas-webhook`

---

## Passo 1 — SQL: anote o estado atual e jogue o período pra frente
```sql
-- ANOTE estes valores para restaurar depois:
select id, status, current_period_end, asaas_subscription_id
from public.subscriptions
where barbershop_id = '<BARBERSHOP_ID>';

-- coloca o período 300 dias à frente, para o encurtamento ficar evidente:
update public.subscriptions
set status = 'active', current_period_end = now() + interval '300 days'
where barbershop_id = '<BARBERSHOP_ID>';
```

## Passo 2 — PowerShell: dispara o webhook de ESTORNO
```powershell
$ref          = "fjfrybzaeghouslsyhgl"
$token        = "<ASAAS_WEBHOOK_TOKEN>"          # o mesmo configurado na function
$barbershopId = "<BARBERSHOP_ID>"

$evt = "evt_test_refund_" + [guid]::NewGuid().ToString('N').Substring(0,12)
$pay = "pay_test_refund_" + [guid]::NewGuid().ToString('N').Substring(0,12)

$body = @{
  id      = $evt
  event   = "PAYMENT_REFUNDED"
  payment = @{
    id                = $pay
    externalReference = $barbershopId      # pack: localiza pela barbearia
    value             = 49.9
    billingType       = "CREDIT_CARD"
    status            = "REFUNDED"
    dueDate           = (Get-Date).ToString("yyyy-MM-dd")
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri "https://$ref.supabase.co/functions/v1/asaas-webhook" `
  -Headers @{ "asaas-access-token" = $token; "Content-Type" = "application/json" } `
  -Body $body
```
**Esperado:** resposta `{ processed = True; event = PAYMENT_REFUNDED }`.
(Token errado → `401 unauthorized`. Se a function exigir JWT, desligue *Verify JWT* na dashboard.)

> Para testar uma **assinatura recorrente** em vez de pack, adicione no `payment`:
> `subscription = "<asaas_subscription_id>"` (o valor que você anotou no passo 1).

## Passo 3 — SQL: verifica que encurtou
```sql
select status,
       current_period_end,
       status = 'past_due'                              as virou_past_due,   -- esperado true
       current_period_end <= now() + interval '3 days'  as encurtou_ok       -- esperado true (~now+2d)
from public.subscriptions
where barbershop_id = '<BARBERSHOP_ID>';
```
**PASS** se `virou_past_due = true` **e** `encurtou_ok = true`.

## Passo 4 — SQL: restaura o estado e limpa os registros de teste
```sql
update public.subscriptions
set status = '<STATUS_ORIGINAL>', current_period_end = '<PERIODO_ORIGINAL>'  -- valores do passo 1
where barbershop_id = '<BARBERSHOP_ID>';

delete from public.payments       where asaas_payment_id like 'pay_test_refund_%';
delete from public.webhook_events where asaas_event_id  like 'evt_test_refund_%';
```

---

## Testes manuais pela UI (rápidos)
- **#2 mensal→pacote:** logado como dono de uma **assinatura mensal ativa**, abra *Assinar* →
  deve **conseguir** chegar no checkout e comprar um pacote (antes redirecionava/bloqueava).
- **#4 cupom:** aplique um cupom válido num checkout → `uses_count` sobe **exatamente 1**
  (confira em `select code, uses_count from coupons`). Cupom no limite → erro `coupon_exhausted`.
- **#1 cadastro:** crie uma barbearia nova → perfil/barbearia/assinatura trial criados normalmente
  (prova que o trigger com `search_path` travado segue funcionando).
