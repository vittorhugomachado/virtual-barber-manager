-- =============================================================================
-- Endurecimento de segurança do fluxo de cadastro
-- Cobre os achados da auditoria:
--   2 - barbershops_select_public vazava email/phone/owner_id para anon
--   3 - funções SECURITY DEFINER sem search_path fixo (+ qualificação de schema)
--   4 - cleanup_unverified_users chamável por anon (deleção em massa)
--   9 - normalização de email inconsistente em check_user_confirmation_status
--
-- NÃO coberto aqui (de propósito):
--   5 - check_email_exists / check_phone_exists / check_user_confirmation_status
--       são oráculos de enumeração, MAS são chamados pelo frontend ANTES do
--       signUp (usuário ainda anônimo). Revogar de `anon` quebraria o cadastro.
--       A mitigação correta é captcha + rate-limit na borda (Edge Function /
--       gateway), não em SQL.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ACHADO 2 — Vazamento de PII na leitura pública de barbershops
--
-- RLS é por linha, não por coluna: a policy barbershops_select_public
-- (is_active = true, role public) expunha TODAS as colunas, inclusive email,
-- phone e owner_id, para usuários anônimos.
--
-- Correção: anon perde acesso à tabela base e passa a ler apenas uma VIEW
-- curada com colunas não sensíveis. A view roda com os privilégios do owner
-- (não usa security_invoker), então o filtro is_active = true é aplicado por
-- ela mesma — comportamento intencional para uma projeção pública read-only.
-- -----------------------------------------------------------------------------

-- 1. anon não acessa mais a tabela base diretamente.
revoke select on public.barbershops from anon;
drop policy if exists barbershops_select_public on public.barbershops;

-- 2. View pública apenas com colunas seguras (sem email, phone, owner_id).
create or replace view public.public_barbershops as
  select
    id,
    name,
    slug,
    description,
    logo_url,
    banner_url,
    template,
    is_active,
    created_at
  from public.barbershops
  where is_active = true;

grant select on public.public_barbershops to anon, authenticated;

comment on view public.public_barbershops is
  'Projeção pública e read-only de barbershops. Expõe apenas colunas não '
  'sensíveis. Use esta view nas páginas públicas (vitrine/agendamento); '
  'NUNCA exponha public.barbershops diretamente ao role anon.';


-- -----------------------------------------------------------------------------
-- ACHADO 3 + 9 — search_path fixo, qualificação de schema e normalização
--
-- Recriamos cada função SECURITY DEFINER com `set search_path = ''` e todas as
-- referências qualificadas por schema. Sem isso, `search_path = ''` quebraria
-- check_phone_exists (que referenciava `barbershops` sem schema) e abriria
-- espaço para search_path hijacking nas demais.
--
-- Objetos de pg_catalog (lower, trim, now, interval, etc.) continuam resolvendo
-- mesmo com search_path vazio, pois pg_catalog é sempre implícito.
-- -----------------------------------------------------------------------------

create or replace function public.check_email_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from auth.users
    where email = lower(trim(p_email))
  );
end;
$$;

create or replace function public.check_phone_exists(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.barbershops          -- qualificado (achado 3)
    where phone = '55' || p_phone
  );
end;
$$;

create or replace function public.check_user_confirmation_status(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
begin
  select *
  into v_user
  from auth.users
  where email = lower(trim(p_email))  -- normaliza igual ao signup (achado 9)
  limit 1;

  if not found then
    return jsonb_build_object('exists', false, 'is_confirmed', false);
  end if;

  return jsonb_build_object(
    'exists', true,
    'is_confirmed', v_user.email_confirmed_at is not null
  );
end;
$$;

create or replace function public.cleanup_unverified_users()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select id
    from auth.users
    where email_confirmed_at is null
      and created_at < now() - interval '48 hours'
  loop
    -- 1. filhos da barbershop
    delete from public.store_style
    where barbershop_id in (
      select id from public.barbershops where owner_id = v_user_id
    );

    -- 2. barbershop
    delete from public.barbershops where owner_id = v_user_id;

    -- 3. profile
    delete from public.profiles where id = v_user_id;

    -- 4. auth (sempre por último)
    delete from auth.users where id = v_user_id;
  end loop;
end;
$$;


-- -----------------------------------------------------------------------------
-- ACHADO 4 — cleanup_unverified_users não pode ser chamada pelo cliente
--
-- É uma rotina de manutenção. Deve rodar via pg_cron / Edge Function com
-- service_role. Revogamos de todos os roles do cliente.
-- -----------------------------------------------------------------------------

revoke all on function public.cleanup_unverified_users() from public;
revoke all on function public.cleanup_unverified_users() from anon;
revoke all on function public.cleanup_unverified_users() from authenticated;
