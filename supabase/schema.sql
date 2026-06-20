-- ============================================================================
-- SNAPSHOT DO SCHEMA (somente referência — NÃO é para rodar)
-- ============================================================================
-- Objetivo: dar visibilidade da estrutura do banco dentro do repositório
-- (tabelas, enums, funções/RPCs e políticas RLS), já que o `supabase db dump`
-- exige Docker. Atualize este arquivo quando o banco mudar.
--
-- COMO ATUALIZAR (no SQL Editor do Supabase, sem Docker):
--   - Tabelas:   Dashboard -> Database -> "Copy schema" (o bloco abaixo).
--   - Enums/Funções/RLS: rode as queries das seções correspondentes e cole.
--
-- NUNCA cole dados (PII: CPF/CNPJ, e-mails) nem segredos aqui.
-- ============================================================================


-- ============================================================================
-- 1. TABELAS
-- ============================================================================

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  role USER-DEFINED NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.barbershops (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  phone text UNIQUE,
  email text UNIQUE,
  description text,
  logo_url text,
  banner_url text,
  template text NOT NULL DEFAULT 'default'::text CHECK (template = 'default'::text),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT barbershops_pkey PRIMARY KEY (id),
  CONSTRAINT barbershops_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.store_style (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL UNIQUE,
  primary_color text NOT NULL DEFAULT '#000000'::text,
  text_color text NOT NULL DEFAULT '#FFFFFF'::text,
  text_button_color text NOT NULL DEFAULT '#000000'::text,
  background_color text NOT NULL DEFAULT '#09090B'::text,
  title_font text NOT NULL DEFAULT 'inter'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT store_style_pkey PRIMARY KEY (id),
  CONSTRAINT store_style_barbershop_id_fkey FOREIGN KEY (barbershop_id) REFERENCES public.barbershops(id)
);

CREATE TABLE public.barbershop_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'reader'::member_role,
  username text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT barbershop_members_pkey PRIMARY KEY (id),
  CONSTRAINT barbershop_members_barbershop_id_fkey FOREIGN KEY (barbershop_id) REFERENCES public.barbershops(id),
  CONSTRAINT barbershop_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  product_code text NOT NULL,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  asaas_cycle text NOT NULL CHECK (asaas_cycle = ANY (ARRAY['WEEKLY'::text, 'BIWEEKLY'::text, 'MONTHLY'::text, 'QUARTERLY'::text, 'SEMIANNUALLY'::text, 'YEARLY'::text])),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL UNIQUE,
  plan_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'trialing'::subscription_status,
  trial_ends_at timestamp with time zone,
  asaas_customer_id text,
  asaas_subscription_id text UNIQUE,
  current_period_end timestamp with time zone,
  canceled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  grace_period_days integer NOT NULL DEFAULT 6,
  provisioning_started_at timestamp with time zone,
  pending_period_end timestamp with time zone,   -- #9: fim preservando dias (dica p/ o webhook no PIX; NÃO libera acesso)
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_barbershop_id_fkey FOREIGN KEY (barbershop_id) REFERENCES public.barbershops(id),
  CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id)
);

CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  asaas_payment_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  billing_type text,
  status text NOT NULL,
  due_date date,
  paid_at timestamp with time zone,
  invoice_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id)
);

CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asaas_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamp with time zone,
  error text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.asaas_rate_limits (
  key text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asaas_rate_limits_pkey PRIMARY KEY (key)
);

CREATE TABLE public.ops_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  level text NOT NULL DEFAULT 'warning'::text,
  source text NOT NULL,
  kind text NOT NULL,
  message text,
  context jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT ops_alerts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL UNIQUE,
  country text NOT NULL DEFAULT 'Brasil'::text,
  state USER-DEFINED NOT NULL,
  zip_code character NOT NULL,
  neighborhood text NOT NULL,
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  latitude double precision,
  longitude double precision,
  city text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT addresses_pkey PRIMARY KEY (id),
  CONSTRAINT addresses_barbershop_id_fkey FOREIGN KEY (barbershop_id) REFERENCES public.barbershops(id)
);

-- Cupons de desconto para influenciadores e campanhas.
-- discount_type: 'percentage' (0-100) ou 'fixed' (valor em reais, ex: 50 = R$50 off).
-- max_uses null = ilimitado.
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);


-- ============================================================================
-- 2. ENUMS
-- ============================================================================

CREATE TYPE public.appointment_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_barbershop',
  'no_show'
);

CREATE TYPE public.brazilian_state AS ENUM (
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
);

-- member_role: NÃO inclui 'owner' — o dono é identificado por barbershops.owner_id
CREATE TYPE public.member_role AS ENUM (
  'admin',
  'reader'
);

CREATE TYPE public.profile_role AS ENUM (
  'barbershop_member',
  'barbershop',
  'master'
);

CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'incomplete',
  'active',
  'past_due',
  'canceled'
);


-- ============================================================================
-- 3. FUNÇÕES / RPCs
-- ============================================================================

-- Controle de rate-limit para chamadas à API Asaas.
-- Retorna TRUE se ainda está dentro do limite, FALSE se excedeu.
-- Usado em: asaas-webhook, reconcile-subscriptions, new-create-subscription.
CREATE OR REPLACE FUNCTION public.asaas_rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
  v_count int;
begin
  insert into public.asaas_rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when public.asaas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then 1
          else public.asaas_rate_limits.count + 1
        end,
        window_start = case
          when public.asaas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
          else public.asaas_rate_limits.window_start
        end
  returning count into v_count;
  return v_count <= p_max;
end;
$function$;

-- Verifica se um e-mail já existe em auth.users.
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin
  return exists (select 1 from auth.users where email = lower(trim(p_email)));
end;
$function$;

-- Verifica se um telefone já está cadastrado em barbershops (prefixo '55').
CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin
  return exists (select 1 from public.barbershops where phone = '55' || p_phone);
end;
$function$;

-- Retorna { exists, is_confirmed } para um e-mail — usado no fluxo de login
-- para diferenciar "nunca cadastrou" de "cadastrou mas não confirmou".
CREATE OR REPLACE FUNCTION public.check_user_confirmation_status(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
  v_user auth.users%rowtype;
begin
  select * into v_user from auth.users where email = lower(trim(p_email)) limit 1;
  if not found then
    return jsonb_build_object('exists', false, 'is_confirmed', false);
  end if;
  return jsonb_build_object('exists', true, 'is_confirmed', v_user.email_confirmed_at is not null);
end;
$function$;

-- Lock de provisionamento: retorna TRUE e seta provisioning_started_at somente
-- se o lock está livre (nunca setado, ou setado há mais de 2 minutos — request
-- morreu no meio). NÃO depende de asaas_subscription_id, para permitir troca de
-- plano (mensal->pacote) e re-assinatura a qualquer momento.
-- Chamado em: create-monthly-subscription / buy-pack (início do checkout).
CREATE OR REPLACE FUNCTION public.claim_subscription_provisioning(p_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $function$
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

-- Remove usuários não confirmados criados há mais de 48h (limpeza periódica).
-- Apaga os filhos da barbearia na ordem de dependência antes da barbearia
-- (anti-FK; funciona com ou sem ON DELETE CASCADE) — ver supabase/medium-light-fixes.sql.
CREATE OR REPLACE FUNCTION public.cleanup_unverified_users()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
  v_user_id       uuid;
  v_barbershop_id uuid;
begin
  for v_user_id in
    select id from auth.users
    where email_confirmed_at is null and created_at < now() - interval '48 hours'
  loop
    select id into v_barbershop_id from public.barbershops where owner_id = v_user_id;
    if v_barbershop_id is not null then
      delete from public.payments where subscription_id in (
        select id from public.subscriptions where barbershop_id = v_barbershop_id
      );
      delete from public.subscriptions     where barbershop_id = v_barbershop_id;
      delete from public.addresses         where barbershop_id = v_barbershop_id;
      delete from public.store_style        where barbershop_id = v_barbershop_id;
      delete from public.barbershop_members where barbershop_id = v_barbershop_id;
      delete from public.barbershops        where id = v_barbershop_id;
    end if;
    delete from public.profiles where id = v_user_id;
    delete from auth.users      where id = v_user_id;
  end loop;
end;
$function$;

-- Remove um membro de uma barbearia. Só pode ser chamado pelo dono (owner_id).
-- Deleta o auth.user → cascata apaga profiles e barbershop_members.
CREATE OR REPLACE FUNCTION public.delete_member(p_member_id uuid, p_barbershop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth' AS $function$
declare
  v_user_id uuid;
begin
  if not exists (select 1 from barbershops where id = p_barbershop_id and owner_id = auth.uid()) then
    raise exception 'not_barbershop_owner';
  end if;
  select user_id into v_user_id from barbershop_members where id = p_member_id and barbershop_id = p_barbershop_id;
  if v_user_id is null then raise exception 'member_not_found'; end if;
  delete from auth.users where id = v_user_id;
end;
$function$;

-- Retorna o e-mail sintético de um membro para autenticação:
-- formato: "<username>@<barbershop_id>.member"
CREATE OR REPLACE FUNCTION public.get_member_auth_email(p_username text, p_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select bm.username || '@' || bm.barbershop_id::text || '.member'
  from public.barbershop_members bm
  join public.barbershops bs on bs.id = bm.barbershop_id
  where bm.username = p_username and bs.slug = p_slug
  limit 1;
$function$;

-- Retorna o barbershop_id do membro logado (usuário não-dono).
-- Usado em: use-barbershop-data.ts (caminho membro), protected-route.
CREATE OR REPLACE FUNCTION public.get_my_member_barbershop_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select barbershop_id from public.barbershop_members
  where user_id = auth.uid() order by created_at asc limit 1;
$function$;

-- Trigger: cria profile + barbershop + store_style + subscription (trial 30d)
-- quando um novo usuário com role='barbershop' se cadastra.
-- Também gera o slug único a partir do nome da barbearia.
-- SET search_path TO '' (anti search_path hijacking) — ver supabase/critical-fixes.sql.
CREATE OR REPLACE FUNCTION public.handle_new_barbershop_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
-- (definição completa e versionada em supabase/critical-fixes.sql)
-- Passos: valida role, idempotência, telefone duplicado, gera slug,
--         insere profiles, barbershops, store_style e subscriptions (trialing).
$function$;

-- has_active_access: alias de is_barbershop_active (fonte única de verdade).
-- Era código morto e divergente (status-based, grace fixo 5d). Agora delega
-- para is_barbershop_active — ver supabase/medium-light-fixes.sql.
CREATE OR REPLACE FUNCTION public.has_active_access(p_barbershop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select public.is_barbershop_active(p_barbershop_id);
$function$;

-- Versão mais completa de has_active_access: inclui grace_period_days dinâmico
-- e exclui explicitamente canceled. Usada em lógica de negócio.
CREATE OR REPLACE FUNCTION public.is_barbershop_active(p_barbershop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (
    select 1 from public.subscriptions s
    where s.barbershop_id = p_barbershop_id
      and s.status <> 'canceled'
      and (
        (s.current_period_end is not null
          and now() < s.current_period_end + make_interval(days => coalesce(s.grace_period_days, 6)))
        or
        (s.status = 'trialing' and s.trial_ends_at is not null and now() < s.trial_ends_at)
      )
  );
$function$;

-- Checa se o usuário logado é admin de uma barbearia específica.
CREATE OR REPLACE FUNCTION public.is_barbershop_admin(p_barbershop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (
    select 1 from public.barbershop_members
    where user_id = auth.uid() and barbershop_id = p_barbershop_id and role = 'admin'
  );
$function$;

-- Checa se o usuário logado é membro (qualquer role) de uma barbearia.
CREATE OR REPLACE FUNCTION public.is_barbershop_member(p_barbershop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (
    select 1 from public.barbershop_members
    where user_id = auth.uid() and barbershop_id = p_barbershop_id
  );
$function$;

-- Valida um cupom pelo código (case-insensitive). Seguro para chamar do frontend
-- (SECURITY DEFINER — não expõe dados sensíveis, só retorna se é válido e o desconto).
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_coupon public.coupons%rowtype;
BEGIN
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(code) = upper(trim(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid',          true,
    'id',             v_coupon.id,
    'discount_type',  v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'description',    v_coupon.description
  );
END;
$function$;

-- Consome um uso do cupom de forma ATÔMICA (guarda max_uses/expires/is_active).
-- Retorna false se não pôde consumir. Só service_role (edge functions).
-- Substitui o read-modify-write que permitia estourar max_uses por concorrência.
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $function$
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

-- Libera a reserva de cupom quando a cobrança falha (best-effort, >= 0).
CREATE OR REPLACE FUNCTION public.decrement_coupon_usage(p_coupon_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $function$
  update public.coupons set uses_count = greatest(uses_count - 1, 0)
  where id = p_coupon_id;
$function$;

-- Trigger helper: seta updated_at = now() em qualquer UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;


-- ============================================================================
-- 4. POLÍTICAS RLS
-- ============================================================================

-- barbershop_members
--   INSERT gate_inserts          → WITH CHECK: is_barbershop_active(barbershop_id)
--   SELECT member can view own   → USING: user_id = auth.uid()
--   ALL    owner full access     → USING: EXISTS (SELECT 1 FROM barbershops WHERE id = barbershop_id AND owner_id = auth.uid())

-- barbershops
--   DELETE barbershops_delete_owner → USING: auth.uid() = owner_id
--   SELECT barbershops_select_member → USING: is_barbershop_member(id)
--   SELECT barbershops_select_owner  → USING: auth.uid() = owner_id
--   UPDATE barbershops_update_owner  → USING + WITH CHECK: auth.uid() = owner_id

-- payments
--   SELECT payments_select_owner → USING: EXISTS (
--     SELECT 1 FROM subscriptions s JOIN barbershops b ON b.id = s.barbershop_id
--     WHERE s.id = payments.subscription_id AND b.owner_id = auth.uid())

-- plans
--   SELECT plans_select_active_or_own → USING: is_active = true
--     OR EXISTS (SELECT 1 FROM subscriptions s JOIN barbershops b ON b.id = s.barbershop_id
--                WHERE s.plan_id = plans.id AND b.owner_id = auth.uid())

-- profiles
--   SELECT profiles_select_owner → USING: auth.uid() = id

-- store_style
--   SELECT store_style_select_public → USING: true  (público)
--   UPDATE store_style_update_owner  → USING + WITH CHECK:
--     barbershop_id IN (SELECT id FROM barbershops WHERE owner_id = auth.uid())

-- subscriptions
--   SELECT subscriptions_select_owner → USING: EXISTS (
--     SELECT 1 FROM barbershops b WHERE b.id = barbershop_id AND b.owner_id = auth.uid())

-- coupons
--   Sem política de SELECT para clientes — validação via RPC validate_coupon (SECURITY DEFINER).
--   INSERT/UPDATE/DELETE: apenas service_role (edge functions).
