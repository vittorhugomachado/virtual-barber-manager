-- ============================================================================
-- medium-light-fixes.sql
-- Correções de severidade MÉDIA/LEVE do fluxo de pagamento.
-- Rodar no Supabase > SQL Editor. Idempotente.
--
-- Conteúdo:
--   #5  cleanup_unverified_users  -> apaga filhos antes da barbearia (anti-FK)
--   #8  has_active_access         -> passa a delegar para is_barbershop_active
--   #11 validate_coupon           -> revoga de anon/PUBLIC (anti-enumeração)
--
-- O fix #6 (estorno/chargeback encurta o período) é nas edge functions
-- asaas-webhook e reconcile-subscriptions (TypeScript) — redeployar.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- #5  cleanup_unverified_users: apaga os filhos da barbearia ANTES da barbearia.
--
-- Antes só apagava store_style; como todo signup cria uma subscription (trial)
-- e os FKs de subscriptions/addresses -> barbershops podem não ser ON DELETE
-- CASCADE, o "delete from barbershops" estourava FK e abortava a limpeza.
-- Esta versão apaga na ordem de dependência (neto -> filho -> pai); funciona
-- com OU sem cascade.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_unverified_users()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
declare
  v_user_id       uuid;
  v_barbershop_id uuid;
begin
  for v_user_id in
    select id
    from auth.users
    where email_confirmed_at is null
      and created_at < now() - interval '48 hours'
  loop
    -- owner_id é único: no máximo uma barbearia por usuário.
    select id into v_barbershop_id
    from public.barbershops
    where owner_id = v_user_id;

    if v_barbershop_id is not null then
      -- Neto: payments depende de subscriptions.
      delete from public.payments
      where subscription_id in (
        select id from public.subscriptions where barbershop_id = v_barbershop_id
      );

      -- Filhos diretos da barbearia.
      delete from public.subscriptions     where barbershop_id = v_barbershop_id;
      delete from public.addresses         where barbershop_id = v_barbershop_id;
      delete from public.store_style        where barbershop_id = v_barbershop_id;
      delete from public.barbershop_members where barbershop_id = v_barbershop_id;

      -- A barbearia em si.
      delete from public.barbershops where id = v_barbershop_id;
    end if;

    -- Profile e, por último, o auth.user.
    delete from public.profiles where id = v_user_id;
    delete from auth.users      where id = v_user_id;
  end loop;
end;
$function$;


-- ----------------------------------------------------------------------------
-- #8  has_active_access: fonte ÚNICA de verdade.
--
-- Era código morto (ninguém chamava) e divergente de is_barbershop_active:
-- liberava status='active' sem checar período e usava grace fixo de 5 dias.
-- Passa a delegar para is_barbershop_active (período + grace_period_days),
-- mantida como alias por compatibilidade caso algo ainda a referencie.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_access(p_barbershop_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  select public.is_barbershop_active(p_barbershop_id);
$function$;


-- ----------------------------------------------------------------------------
-- #11 validate_coupon: remove acesso de anon (anti-enumeração de cupons).
--
-- Toda função nasce com EXECUTE para PUBLIC; o checkout chama validate_coupon
-- já autenticado (dono logado). Revogar de PUBLIC e conceder só a authenticated
-- impede que visitantes anônimos fiquem testando códigos de cupom.
-- (Brute-force por usuário autenticado ainda é possível — mitigar com rate
--  limit no futuro, se necessário.)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_coupon(text) TO authenticated, service_role;
