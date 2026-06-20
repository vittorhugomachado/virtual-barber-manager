-- ============================================================================
-- critical-fixes.sql
-- Correções críticas do fluxo de pagamento (rodar no Supabase > SQL Editor).
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
--
-- Conteúdo:
--   #1  handle_new_barbershop_user  -> adiciona SET search_path (anti-hijack)
--   #2  claim_subscription_provisioning -> permite troca/renovação de plano
--   #4  increment_coupon_usage / decrement_coupon_usage -> cupom atômico
--
-- Os fixes #3 (reconcile pack) são só nas edge functions (TypeScript).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- #1  handle_new_barbershop_user: SECURITY DEFINER agora com SET search_path.
--
-- Era a ÚNICA função SECURITY DEFINER sem search_path fixo. Como pg_catalog é
-- sempre pesquisado primeiro quando o search_path não o lista, definir como ''
-- impede que um schema controlado pelo atacante (ex.: public) seja consultado
-- antes do pg_catalog para resolver now(), gen_random_uuid(), etc. As tabelas
-- já são todas qualificadas com public.*.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_barbershop_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''                       -- <<< FIX #1: trava o search_path
AS $function$
declare
  v_meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role            text  := v_meta->>'role';
  v_owner_name      text  := v_meta->>'name';
  v_phone_raw       text  := v_meta->>'phone';
  v_barbershop_name text  := v_meta->>'barbershop_name';
  v_barbershop_id   uuid  := gen_random_uuid();
  v_id_clean        text  := replace(v_barbershop_id::text, '-', '');
  v_base_slug       text;
  v_slug            text;
  v_plan_id         uuid;
begin
  -- 1. Só atua em cadastros de DONO de barbearia.
  if v_role is distinct from 'barbershop' or v_barbershop_name is null then
    return new;
  end if;

  -- 2. Idempotência.
  if exists (select 1 from public.barbershops where owner_id = new.id) then
    return new;
  end if;

  -- 3. Telefone duplicado.
  if v_phone_raw is not null and exists (
    select 1 from public.barbershops where phone = '55' || v_phone_raw
  ) then
    raise exception 'phone_already_exists';
  end if;

  -- 4. Slug a partir do nome (remove acentos, normaliza).
  v_base_slug := regexp_replace(
    regexp_replace(
      translate(
        lower(v_barbershop_name),
        'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
        'aaaaaaeeeeiiiioooooouuuuyycon'
      ),
      '[^a-z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  );
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug is null or v_base_slug = '' then
    v_base_slug := 'barbearia';
  end if;

  -- 5. Colisão de slug.
  v_slug := v_base_slug;
  if exists (select 1 from public.barbershops where slug = v_slug) then
    v_slug := v_base_slug || '-' || left(v_id_clean, 4);
    if exists (select 1 from public.barbershops where slug = v_slug) then
      v_slug := v_base_slug || '-' || left(v_id_clean, 15);
    end if;
  end if;

  -- 6. Profile (role fixo no servidor).
  insert into public.profiles (id, role, name)
  values (new.id, 'barbershop', v_owner_name)
  on conflict (id) do update
    set role = 'barbershop', name = excluded.name;

  -- 7. Barbearia (email vem do Auth).
  insert into public.barbershops (id, owner_id, name, slug, email, phone)
  values (
    v_barbershop_id, new.id, v_barbershop_name, v_slug, new.email,
    case when v_phone_raw is null then null else '55' || v_phone_raw end
  );

  -- 8. Estilo padrão.
  insert into public.store_style (barbershop_id) values (v_barbershop_id);

  -- 9. Assinatura trial (30 dias).
  select id into v_plan_id
  from public.plans
  where product_code = 'pro' and is_active = true
  order by sort_order
  limit 1;

  if v_plan_id is not null then
    insert into public.subscriptions (barbershop_id, plan_id, status, trial_ends_at)
    values (v_barbershop_id, v_plan_id, 'trialing', now() + interval '30 days');
  end if;

  return new;
end;
$function$;


-- ----------------------------------------------------------------------------
-- #2  claim_subscription_provisioning: remove a condição
--     "asaas_subscription_id is null".
--
-- Antes, quem já tinha assinatura mensal recorrente NUNCA passava do lock
-- (recebia 409 provisioning_in_progress) e o ramo que cancela a recorrência
-- no Asaas era código morto. Agora o lock depende só de provisioning_started_at,
-- liberando troca mensal->pacote (e re-assinatura) a qualquer momento.
-- A proteção anti-corrida (claim de 2 min) é mantida.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_subscription_provisioning(p_id uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  with claimed as (
    update public.subscriptions
    set provisioning_started_at = now()
    where id = p_id
      and (provisioning_started_at is null
           or provisioning_started_at < now() - interval '2 minutes')
    returning id
  )
  select exists (select 1 from claimed);
$function$;


-- ----------------------------------------------------------------------------
-- #4  Cupom atômico.
--
-- increment_coupon_usage: incrementa uses_count em UMA operação atômica,
-- com guarda max_uses/expires/is_active. Retorna false se o cupom não pôde ser
-- consumido (esgotado/expirado/inativo). Substitui o read-modify-write das edge
-- functions, que permitia estourar max_uses por concorrência.
--
-- decrement_coupon_usage: libera a reserva quando a cobrança falha depois de
-- reservada (best-effort, nunca abaixo de zero).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  with updated as (
    update public.coupons
    set uses_count = uses_count + 1
    where id = p_coupon_id
      and is_active = true
      and (expires_at is null or expires_at > now())
      and (max_uses is null or uses_count < max_uses)
    returning id
  )
  select exists (select 1 from updated);
$function$;

CREATE OR REPLACE FUNCTION public.decrement_coupon_usage(p_coupon_id uuid)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  update public.coupons
  set uses_count = greatest(uses_count - 1, 0)
  where id = p_coupon_id;
$function$;

-- Estas RPCs são exclusivas das edge functions (service_role). Clientes não
-- devem chamá-las diretamente. Revoga de PUBLIC (toda função nasce com EXECUTE
-- p/ PUBLIC) — só revogar de anon/authenticated não bastaria, pois herdariam
-- a permissão via PUBLIC.
REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_coupon_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) TO service_role;
GRANT  EXECUTE ON FUNCTION public.decrement_coupon_usage(uuid) TO service_role;
