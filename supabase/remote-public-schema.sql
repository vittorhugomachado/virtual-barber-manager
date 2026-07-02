


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."appointment_status" AS ENUM (
    'scheduled',
    'completed',
    'cancelled_by_customer',
    'cancelled_by_barbershop',
    'no_show'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."appointment_status" IS 'Tipo usado para definir o status de cada agendamento na tabela public.appointments';



CREATE TYPE "public"."brazilian_state" AS ENUM (
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO'
);


ALTER TYPE "public"."brazilian_state" OWNER TO "postgres";


COMMENT ON TYPE "public"."brazilian_state" IS 'Siglas dos 27 estados brasileiros incluindo o Distrito Federal. Usado na tabela public.addresses.';



CREATE TYPE "public"."member_role" AS ENUM (
    'admin',
    'reader'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."profile_role" AS ENUM (
    'barbershop_member',
    'barbershop',
    'master'
);


ALTER TYPE "public"."profile_role" OWNER TO "postgres";


COMMENT ON TYPE "public"."profile_role" IS 'tipo usado na tabela public.profile para definir a função de cada usuário do sisitema (barbearias, membros e master)';



CREATE TYPE "public"."subscription_status" AS ENUM (
    'trialing',
    'incomplete',
    'active',
    'past_due',
    'canceled'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."asaas_rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_count int;
begin
  insert into public.asaas_rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when public.asaas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then 1                                  -- janela expirou: reinicia
          else public.asaas_rate_limits.count + 1       -- mesma janela: +1
        end,
        window_start = case
          when public.asaas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
          else public.asaas_rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;


ALTER FUNCTION "public"."asaas_rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1
    from auth.users
    where email = lower(trim(p_email))
  );
end;
$$;


ALTER FUNCTION "public"."check_email_exists"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_opening_hours_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM opening_hours
    WHERE barbershop_id = NEW.barbershop_id
      AND day_of_week = NEW.day_of_week
      AND id != NEW.id
      AND (NEW.opens_at < closes_at AND NEW.closes_at > opens_at)
  ) THEN
    RAISE EXCEPTION 'Períodos de horário se sobrepõem no mesmo dia';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_opening_hours_overlap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_phone_exists"("p_phone" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1
    from public.barbershops          -- qualificado (achado 3)
    where phone = '55' || p_phone
  );
end;
$$;


ALTER FUNCTION "public"."check_phone_exists"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_confirmation_status"("p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."check_user_confirmation_status"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_subscription_provisioning"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with claimed as (
    update public.subscriptions
    set provisioning_started_at = now()
    where id = p_id
      and (provisioning_started_at is null
           or provisioning_started_at < now() - interval '2 minutes')
    returning id
  )
  select exists (select 1 from claimed);
$$;


ALTER FUNCTION "public"."claim_subscription_provisioning"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_unverified_users"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."cleanup_unverified_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.coupons
  set uses_count = greatest(uses_count - 1, 0)
  where id = p_coupon_id;
$$;


ALTER FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid;
begin
  -- 1. caller tem que ser o DONO da barbearia
  if not exists (
    select 1 from barbershops
    where id = p_barbershop_id
      and owner_id = auth.uid()   -- auth.uid() = usuário logado, vem do JWT, não dá pra forjar
  ) then
    raise exception 'not_barbershop_owner';
  end if;

  -- 2. membro tem que pertencer a essa barbearia
  select user_id into v_user_id
  from barbershop_members
  where id = p_member_id
    and barbershop_id = p_barbershop_id;

  if v_user_id is null then
    raise exception 'member_not_found';
  end if;

  -- 3. deleta auth.users — cascata apaga profiles e barbershop_members
  delete from auth.users where id = v_user_id;
end;
$$;


ALTER FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select bm.username || '@' || bm.barbershop_id::text || '.member'
  from public.barbershop_members bm
  join public.barbershops         bs on bs.id = bm.barbershop_id
  where bm.username = p_username
    and bs.slug     = p_slug
  limit 1;
$$;


ALTER FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_member_barbershop_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select barbershop_id
  from public.barbershop_members
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
$$;


ALTER FUNCTION "public"."get_my_member_barbershop_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_barbershop_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  -- Extrai os metadados enviados no momento do cadastro (vem do frontend)
  v_meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  
  -- Campos do metadata
  v_role            text  := v_meta->>'role';              -- Papel do usuário (barbershop, customer, etc)
  v_owner_name      text  := v_meta->>'name';              -- Nome do dono da barbearia
  v_phone_raw       text  := v_meta->>'phone';             -- Telefone (sem DDD? verificar formato)
  v_barbershop_name text  := v_meta->>'barbershop_name';   -- Nome da barbearia
  
  -- IDs e slugs
  v_barbershop_id   uuid  := gen_random_uuid();            -- Gera ID único para barbearia
  v_id_clean        text  := replace(v_barbershop_id::text, '-', ''); -- Remove hífens do UUID
  v_base_slug       text;                                   -- Slug base (ex: "minha-barbearia")
  v_slug            text;                                   -- Slug final (com fallbacks se houver colisão)
  
  -- Plano de assinatura
  v_plan_id         uuid;                                   -- ID do plano Pro para trial
begin
  -- ============================================
  -- 1. VALIDAÇÃO DE PAPEL E TIPO DE USUÁRIO
  -- ============================================
  -- Atua somente em cadastros de DONO de barbearia. 
  -- Membros (criados via Edge Function com admin API) e outros papéis caem fora aqui.
  -- Se o role não for 'barbershop' ou não tiver nome da barbearia, não faz nada.
  if v_role is distinct from 'barbershop' or v_barbershop_name is null then
    return new;  -- Retorna sem modificar nada
  end if;

  -- ============================================
  -- 2. IDEMPOTÊNCIA - EVITA DUPLICIDADE
  -- ============================================
  -- Se já existe uma barbearia para este usuário, não cria novamente.
  -- Isso previne execuções duplicadas da trigger.
  if exists (select 1 from public.barbershops where owner_id = new.id) then
    return new;
  end if;

  -- ============================================
  -- 3. VALIDAÇÃO DE TELEFONE DUPLICADO
  -- ============================================
  -- Verifica se o telefone já está cadastrado em outra barbearia.
  -- Concatena '55' (código do Brasil) com o telefone informado.
  -- Se existir, lança um erro que faz o cadastro do usuário falhar.
  if v_phone_raw is not null and exists (
    select 1 from public.barbershops where phone = '55' || v_phone_raw
  ) then
    raise exception 'phone_already_exists';
  end if;

  -- ============================================
  -- 4. GERAÇÃO DO SLUG (URL AMIGÁVEL)
  -- ============================================
  -- Converte "Minha Barbearia Ltda" para "minha-barbearia-ltda"
  
  -- Passo 1: Remove acentos (àáâã → a, etc)
  v_base_slug := regexp_replace(
    regexp_replace(
      translate(
        lower(v_barbershop_name),  -- Converte para minúsculas
        -- Caracteres acentuados -> suas versões sem acento
        'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
        'aaaaaaeeeeiiiioooooouuuuyycon'
      ),
      '[^a-z0-9\s-]',  -- Remove qualquer caractere que não seja letra, número, espaço ou hífen
      '',
      'g'
    ),
    '\s+',  -- Substitui espaços por hífen
    '-',
    'g'
  );

  -- Passo 2: Remove hífens das pontas (ex: "-barbearia-" -> "barbearia")
  v_base_slug := trim(both '-' from v_base_slug);
  
  -- Passo 3: Fallback se o slug ficou vazio (nome só com caracteres especiais)
  if v_base_slug is null or v_base_slug = '' then
    v_base_slug := 'barbearia';
  end if;

  -- ============================================
  -- 5. TRATAMENTO DE COLISÃO DE SLUG
  -- ============================================
  -- Se o slug base já existe, adiciona parte do UUID para torná-lo único
  v_slug := v_base_slug;
  if exists (select 1 from public.barbershops where slug = v_slug) then
    -- Primeiro fallback: adiciona 4 primeiros caracteres do UUID
    v_slug := v_base_slug || '-' || left(v_id_clean, 4);
    
    -- Segundo fallback (improvável): adiciona 15 primeiros caracteres
    if exists (select 1 from public.barbershops where slug = v_slug) then
      v_slug := v_base_slug || '-' || left(v_id_clean, 15);
    end if;
  end if;

  -- ============================================
  -- 6. CRIAÇÃO DO PERFIL DO USUÁRIO
  -- ============================================
  -- Insere ou atualiza o perfil na tabela profiles
  -- role é FIXO no servidor (barbershop), nunca vem do metadata por segurança
  insert into public.profiles (id, role, name)
  values (new.id, 'barbershop', v_owner_name)
  on conflict (id) do update  -- Se já existir (por alguma razão), atualiza
    set role = 'barbershop',
        name = excluded.name;

  -- ============================================
  -- 7. CRIAÇÃO DA BARBEARIA
  -- ============================================
  -- Insere o registro principal da barbearia
  -- Email vem do Auth (new.email), não do metadata (mais seguro)
  insert into public.barbershops (id, owner_id, name, slug, email, phone)
  values (
    v_barbershop_id,
    new.id,                    -- owner_id = ID do usuário no Auth
    v_barbershop_name,
    v_slug,
    new.email,                 -- Email verificado pelo Auth
    case when v_phone_raw is null 
         then null 
         else '55' || v_phone_raw  -- Adiciona código do Brasil
    end
  );

  -- ============================================
  -- 8. CRIAÇÃO DO ESTILO PADRÃO DA LOJA
  -- ============================================
  -- Toda barbearia precisa de configurações de estilo (cores, tema, etc)
  -- Insere um registro padrão com valores default
  insert into public.store_style (barbershop_id)
  values (v_barbershop_id);

  -- ============================================
  -- 9. CRIAÇÃO DA ASSINATURA TRIAL
  -- ============================================
  -- Busca o ID do plano Pro ativo (menor sort_order)
  -- product_code = 'pro' identifica o plano principal
  select id into v_plan_id
  from public.plans
  where product_code = 'pro' and is_active = true
  order by sort_order  -- Pega o mais barato/recomendado
  limit 1;

  -- Só cria a assinatura se encontrou um plano ativo
  -- Se não encontrar, não bloqueia o cadastro (fallback silencioso)
  if v_plan_id is not null then
    insert into public.subscriptions (
      barbershop_id, 
      plan_id, 
      status, 
      trial_ends_at
    ) values (
      v_barbershop_id, 
      v_plan_id, 
      'trialing',                    -- Status: período de teste
      now() + interval '30 days'     -- Trial de 30 dias
    );
  end if;

  -- ============================================
  -- 10. RETORNA O REGISTRO ORIGINAL
  -- ============================================
  -- Deve retornar NEW (registro do auth.users) para a operação continuar
  -- Se retornasse NULL, a inserção do usuário seria cancelada
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_barbershop_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_access"("p_barbershop_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.is_barbershop_active(p_barbershop_id);
$$;


ALTER FUNCTION "public"."has_active_access"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_coupon_usage"("p_coupon_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."increment_coupon_usage"("p_coupon_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_barbershop_active"("p_barbershop_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.subscriptions s
    where s.barbershop_id = p_barbershop_id
      and s.status <> 'canceled'
      and (
        -- PAGO: vale até o fim do período + carência
        (s.current_period_end is not null
          and now() < s.current_period_end + make_interval(days => coalesce(s.grace_period_days, 6)))
        or
        -- TRIAL: vale até o fim do trial
        (s.status = 'trialing'
          and s.trial_ends_at is not null
          and now() < s.trial_ends_at)
      )
  );
$$;


ALTER FUNCTION "public"."is_barbershop_active"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_barbershop_admin"("p_barbershop_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.barbershop_members
    where user_id       = auth.uid()
      and barbershop_id = p_barbershop_id
      and role          = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_barbershop_admin"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_barbershop_member"("p_barbershop_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.barbershop_members
    where user_id       = auth.uid()
      and barbershop_id = p_barbershop_id
  );
$$;


ALTER FUNCTION "public"."is_barbershop_member"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_updated_at"() IS 'Trigger genérico que atualiza o campo updated_at automaticamente em qualquer tabela.';



CREATE OR REPLACE FUNCTION "public"."sync_barbershop_timezone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$-- Sincroniza o timezone da barbearia sempre que o estado do endereço for inserido ou alterado.
declare tz TEXT;

begin tz := case NEW.state
  when 'AC' then 'America/Rio_Branco'
  when 'AM' then 'America/Manaus'
  when 'MS' then 'America/Campo_Grande'
  when 'MT' then 'America/Cuiaba'
  when 'PA' then 'America/Belem'
  when 'RO' then 'America/Porto_Velho'
  when 'RR' then 'America/Boa_Vista'
  when 'TO' then 'America/Araguaina'
  else 'America/Sao_Paulo'
end;

update barbershops
set
  timezone = tz
where
  id = NEW.barbershop_id;

RETURN NEW;

end;$$;


ALTER FUNCTION "public"."sync_barbershop_timezone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_coupon"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_coupon"("p_code" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "country" "text" DEFAULT 'Brasil'::"text" NOT NULL,
    "state" "public"."brazilian_state" NOT NULL,
    "zip_code" character(8) NOT NULL,
    "neighborhood" "text" NOT NULL,
    "street" "text" NOT NULL,
    "number" "text" NOT NULL,
    "complement" "text",
    "latitude" double precision,
    "longitude" double precision,
    "city" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asaas_rate_limits" (
    "key" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."asaas_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."barber_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barber_id" "uuid" NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "is_day_off" boolean DEFAULT false NOT NULL,
    "use_custom_hours" boolean DEFAULT false NOT NULL,
    "starts_at" time without time zone,
    "ends_at" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "period_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "barber_availability_custom_hours_check" CHECK ((("use_custom_hours" = false) OR (("use_custom_hours" = true) AND ("starts_at" IS NOT NULL) AND ("ends_at" IS NOT NULL) AND ("starts_at" < "ends_at")))),
    CONSTRAINT "barber_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."barber_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."barbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_url" "text"
);


ALTER TABLE "public"."barbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."barbershop_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" DEFAULT 'reader'::"public"."member_role" NOT NULL,
    "username" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."barbershop_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."barbershop_members" IS 'Membros de cada barbearia';



COMMENT ON COLUMN "public"."barbershop_members"."role" IS 'admin: administrador, writer: pode editar, reader: apenas leitura';



COMMENT ON COLUMN "public"."barbershop_members"."username" IS 'Nome de usuário único dentro da barbearia';



CREATE TABLE IF NOT EXISTS "public"."barbershops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "description" "text",
    "logo_url" "text",
    "banner_url" "text",
    "template" "text" DEFAULT 'default'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "onboarding_step" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "barbershops_template_check" CHECK (("template" = 'default'::"text"))
);


ALTER TABLE "public"."barbershops" OWNER TO "postgres";


COMMENT ON TABLE "public"."barbershops" IS 'Registro principal de cada barbearia. Uma barbearia por owner (owner_id é unique).';



CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "discount_type" "text" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "max_uses" integer,
    "uses_count" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coupons_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "coupons_discount_value_check" CHECK (("discount_value" > (0)::numeric))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opening_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "opens_at" time without time zone NOT NULL,
    "closes_at" time without time zone NOT NULL,
    "is_open" boolean DEFAULT true NOT NULL,
    "period_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "opening_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "opening_hours_time_order_check" CHECK (("opens_at" < "closes_at"))
);


ALTER TABLE "public"."opening_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ops_alerts" (
    "id" bigint NOT NULL,
    "level" "text" DEFAULT 'warning'::"text" NOT NULL,
    "source" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "message" "text",
    "context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone
);


ALTER TABLE "public"."ops_alerts" OWNER TO "postgres";


ALTER TABLE "public"."ops_alerts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ops_alerts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "asaas_payment_id" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "billing_type" "text",
    "status" "text" NOT NULL,
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "invoice_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "product_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_cents" integer NOT NULL,
    "asaas_cycle" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "included_features" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "plans_asaas_cycle_check" CHECK (("asaas_cycle" = ANY (ARRAY['WEEKLY'::"text", 'BIWEEKLY'::"text", 'MONTHLY'::"text", 'QUARTERLY'::"text", 'SEMIANNUALLY'::"text", 'YEARLY'::"text"]))),
    CONSTRAINT "plans_price_cents_check" CHECK (("price_cents" > 0))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."plans" IS 'Catálogo de planos. code = variação (preço+ciclo); product_code agrupa variações do mesmo produto. REGRA: nunca alterar price_cents de uma variação com assinante ativo — criar linha nova e desativar a antiga (grandfathering). asaas_cycle vai direto no campo cycle da API do Asaas.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "role" "public"."profile_role" NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'tabela pública dos usuários do sistema, com exceção dos clientes (customers)';



CREATE OR REPLACE VIEW "public"."public_barbershops" AS
 SELECT "id",
    "name",
    "slug",
    "description",
    "logo_url",
    "banner_url",
    "template",
    "is_active",
    "created_at"
   FROM "public"."barbershops"
  WHERE ("is_active" = true);


ALTER VIEW "public"."public_barbershops" OWNER TO "postgres";


COMMENT ON VIEW "public"."public_barbershops" IS 'Projeção pública e read-only de barbershops. Expõe apenas colunas não sensíveis. Use esta view nas páginas públicas (vitrine/agendamento); NUNCA exponha public.barbershops diretamente ao role anon.';



CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" character varying(100),
    "image_url" "text",
    "duration_min" numeric,
    "price" numeric(10,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_style" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "primary_color" "text" DEFAULT '#000000'::"text" NOT NULL,
    "text_color" "text" DEFAULT '#FFFFFF'::"text" NOT NULL,
    "text_button_color" "text" DEFAULT '#000000'::"text" NOT NULL,
    "background_color" "text" DEFAULT '#09090B'::"text" NOT NULL,
    "title_font" "text" DEFAULT 'inter'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."store_style" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "plan_id" "uuid",
    "status" "public"."subscription_status" DEFAULT 'trialing'::"public"."subscription_status" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "current_period_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "grace_period_days" integer DEFAULT 6 NOT NULL,
    "provisioning_started_at" timestamp with time zone,
    "pending_period_end" timestamp with time zone
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscriptions"."current_period_end" IS 'Fonte do acesso pago. Só é atualizado pelo handler de webhook (service_role) quando o Asaas confirma pagamento. Nunca por outro caminho.';



CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asaas_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed_at" timestamp with time zone,
    "error" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_barbershop_id_key" UNIQUE ("barbershop_id");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asaas_rate_limits"
    ADD CONSTRAINT "asaas_rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_barber_day_order_unique" UNIQUE ("barber_id", "day_of_week", "period_order");



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbers"
    ADD CONSTRAINT "barbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbershop_members"
    ADD CONSTRAINT "barbershop_members_barbershop_user_unique" UNIQUE ("barbershop_id", "user_id");



ALTER TABLE ONLY "public"."barbershop_members"
    ADD CONSTRAINT "barbershop_members_barbershop_username_key" UNIQUE ("barbershop_id", "username");



ALTER TABLE ONLY "public"."barbershop_members"
    ADD CONSTRAINT "barbershop_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opening_hours"
    ADD CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ops_alerts"
    ADD CONSTRAINT "ops_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_asaas_payment_id_key" UNIQUE ("asaas_payment_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_style"
    ADD CONSTRAINT "store_style_barbershop_id_key" UNIQUE ("barbershop_id");



ALTER TABLE ONLY "public"."store_style"
    ADD CONSTRAINT "store_style_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_asaas_subscription_id_key" UNIQUE ("asaas_subscription_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_barbershop_id_key" UNIQUE ("barbershop_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_asaas_event_id_key" UNIQUE ("asaas_event_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "barber_availability_barber_id_idx" ON "public"."barber_availability" USING "btree" ("barber_id");



CREATE INDEX "barber_availability_barbershop_id_idx" ON "public"."barber_availability" USING "btree" ("barbershop_id");



CREATE INDEX "idx_barber_availability_shop_barber_day" ON "public"."barber_availability" USING "btree" ("barbershop_id", "barber_id", "day_of_week");



CREATE INDEX "idx_barbers_barbershop" ON "public"."barbers" USING "btree" ("barbershop_id");



CREATE INDEX "idx_barbershops_is_active" ON "public"."barbershops" USING "btree" ("is_active");



CREATE INDEX "idx_barbershops_slug" ON "public"."barbershops" USING "btree" ("slug");



CREATE INDEX "idx_members_barbershop" ON "public"."barbershop_members" USING "btree" ("barbershop_id");



CREATE INDEX "idx_members_user" ON "public"."barbershop_members" USING "btree" ("user_id");



CREATE INDEX "idx_opening_hours_barbershop" ON "public"."opening_hours" USING "btree" ("barbershop_id");



CREATE INDEX "idx_opening_hours_shop_day" ON "public"."opening_hours" USING "btree" ("barbershop_id", "day_of_week", "is_open");



CREATE INDEX "idx_payments_due_date" ON "public"."payments" USING "btree" ("due_date");



CREATE INDEX "idx_payments_subscription" ON "public"."payments" USING "btree" ("subscription_id");



CREATE INDEX "idx_plans_product" ON "public"."plans" USING "btree" ("product_code");



CREATE INDEX "idx_services_barbershop" ON "public"."services" USING "btree" ("barbershop_id");



CREATE INDEX "idx_subscriptions_asaas_customer" ON "public"."subscriptions" USING "btree" ("asaas_customer_id");



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_webhook_events_unprocessed" ON "public"."webhook_events" USING "btree" ("received_at") WHERE ("processed_at" IS NULL);



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."barbershop_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_addresses_updated_at" BEFORE UPDATE ON "public"."addresses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_barber_availability_updated_at" BEFORE UPDATE ON "public"."barber_availability" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_barbers_updated_at" BEFORE UPDATE ON "public"."barbers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_barbershops_updated_at" BEFORE UPDATE ON "public"."barbershops" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_store_style_updated_at" BEFORE UPDATE ON "public"."store_style" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_barbershop_timezone" AFTER INSERT OR UPDATE OF "state" ON "public"."addresses" FOR EACH ROW EXECUTE FUNCTION "public"."sync_barbershop_timezone"();



CREATE OR REPLACE TRIGGER "trigger_check_opening_hours_overlap" BEFORE INSERT OR UPDATE ON "public"."opening_hours" FOR EACH ROW EXECUTE FUNCTION "public"."check_opening_hours_overlap"();



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbers"
    ADD CONSTRAINT "barbers_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_members"
    ADD CONSTRAINT "barbershop_members_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_members"
    ADD CONSTRAINT "barbershop_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."opening_hours"
    ADD CONSTRAINT "opening_hours_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_style"
    ADD CONSTRAINT "store_style_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



CREATE POLICY "Owners can insert their barbershop address" ON "public"."addresses" FOR INSERT WITH CHECK (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update their barbershop address" ON "public"."addresses" FOR UPDATE USING (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"())))) WITH CHECK (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can view their barbershop address" ON "public"."addresses" FOR SELECT USING (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asaas_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barber_availability" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "barber_availability_delete_owner_admin" ON "public"."barber_availability" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."barbers" "b"
     JOIN "public"."barbershops" "bs" ON (("bs"."id" = "b"."barbershop_id")))
  WHERE (("b"."id" = "barber_availability"."barber_id") AND ("b"."barbershop_id" = "barber_availability"."barbershop_id") AND (("bs"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("barber_availability"."barbershop_id"))))));



CREATE POLICY "barber_availability_insert_owner_admin" ON "public"."barber_availability" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."barbers" "b"
     JOIN "public"."barbershops" "bs" ON (("bs"."id" = "b"."barbershop_id")))
  WHERE (("b"."id" = "barber_availability"."barber_id") AND ("b"."barbershop_id" = "barber_availability"."barbershop_id") AND (("bs"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("barber_availability"."barbershop_id"))))));



CREATE POLICY "barber_availability_select_public" ON "public"."barber_availability" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "barber_availability_update_owner_admin" ON "public"."barber_availability" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."barbers" "b"
     JOIN "public"."barbershops" "bs" ON (("bs"."id" = "b"."barbershop_id")))
  WHERE (("b"."id" = "barber_availability"."barber_id") AND ("b"."barbershop_id" = "barber_availability"."barbershop_id") AND (("bs"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("barber_availability"."barbershop_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."barbers" "b"
     JOIN "public"."barbershops" "bs" ON (("bs"."id" = "b"."barbershop_id")))
  WHERE (("b"."id" = "barber_availability"."barber_id") AND ("b"."barbershop_id" = "barber_availability"."barbershop_id") AND (("bs"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("barber_availability"."barbershop_id"))))));



ALTER TABLE "public"."barbers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "barbers_delete_owner" ON "public"."barbers" FOR DELETE USING (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"())
UNION
 SELECT "barbershop_members"."barbershop_id"
   FROM "public"."barbershop_members"
  WHERE (("barbershop_members"."user_id" = "auth"."uid"()) AND ("barbershop_members"."role" = 'admin'::"public"."member_role")))));



CREATE POLICY "barbers_insert_owner" ON "public"."barbers" FOR INSERT WITH CHECK (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"())
UNION
 SELECT "barbershop_members"."barbershop_id"
   FROM "public"."barbershop_members"
  WHERE (("barbershop_members"."user_id" = "auth"."uid"()) AND ("barbershop_members"."role" = 'admin'::"public"."member_role")))));



CREATE POLICY "barbers_select_public" ON "public"."barbers" FOR SELECT USING (true);



CREATE POLICY "barbers_update_owner" ON "public"."barbers" FOR UPDATE USING (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"())
UNION
 SELECT "barbershop_members"."barbershop_id"
   FROM "public"."barbershop_members"
  WHERE (("barbershop_members"."user_id" = "auth"."uid"()) AND ("barbershop_members"."role" = 'admin'::"public"."member_role")))));



ALTER TABLE "public"."barbershop_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barbershops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "barbershops_delete_owner" ON "public"."barbershops" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "barbershops_select_member" ON "public"."barbershops" FOR SELECT TO "authenticated" USING ("public"."is_barbershop_member"("id"));



CREATE POLICY "barbershops_select_owner" ON "public"."barbershops" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "barbershops_update_owner" ON "public"."barbershops" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gate_inserts" ON "public"."barbershop_members" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ("public"."is_barbershop_active"("barbershop_id"));



CREATE POLICY "member can view own record" ON "public"."barbershop_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."opening_hours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "opening_hours_delete_owner_admin" ON "public"."opening_hours" FOR DELETE USING ((("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))) OR ("barbershop_id" IN ( SELECT "barbershop_members"."barbershop_id"
   FROM "public"."barbershop_members"
  WHERE (("barbershop_members"."user_id" = "auth"."uid"()) AND ("barbershop_members"."role" = 'admin'::"public"."member_role"))))));



CREATE POLICY "opening_hours_insert_owner_admin" ON "public"."opening_hours" FOR INSERT WITH CHECK ((("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))) OR ("barbershop_id" IN ( SELECT "barbershop_members"."barbershop_id"
   FROM "public"."barbershop_members"
  WHERE (("barbershop_members"."user_id" = "auth"."uid"()) AND ("barbershop_members"."role" = 'admin'::"public"."member_role"))))));



CREATE POLICY "opening_hours_select_public" ON "public"."opening_hours" FOR SELECT USING (true);



CREATE POLICY "opening_hours_update_owner_admin" ON "public"."opening_hours" FOR UPDATE USING ((("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))) OR ("barbershop_id" IN ( SELECT "barbershop_members"."barbershop_id"
   FROM "public"."barbershop_members"
  WHERE (("barbershop_members"."user_id" = "auth"."uid"()) AND ("barbershop_members"."role" = 'admin'::"public"."member_role"))))));



ALTER TABLE "public"."ops_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner full access on members" ON "public"."barbershop_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barbershops"
  WHERE (("barbershops"."id" = "barbershop_members"."barbershop_id") AND ("barbershops"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select_owner" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."subscriptions" "s"
     JOIN "public"."barbershops" "b" ON (("b"."id" = "s"."barbershop_id")))
  WHERE (("s"."id" = "payments"."subscription_id") AND ("b"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_select_active_or_own" ON "public"."plans" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR (EXISTS ( SELECT 1
   FROM ("public"."subscriptions" "s"
     JOIN "public"."barbershops" "b" ON (("b"."id" = "s"."barbershop_id")))
  WHERE (("s"."plan_id" = "plans"."id") AND ("b"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_owner" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_select_public" ON "public"."services" FOR SELECT USING (true);



ALTER TABLE "public"."store_style" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_style_select_public" ON "public"."store_style" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "store_style_update_owner" ON "public"."store_style" FOR UPDATE TO "authenticated" USING (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"())))) WITH CHECK (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_select_owner" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "subscriptions"."barbershop_id") AND ("b"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."asaas_rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_opening_hours_overlap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_phone_exists"("p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_confirmation_status"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_confirmation_status"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_confirmation_status"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_subscription_provisioning"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_unverified_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_unverified_users"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_member_barbershop_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_member_barbershop_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_barbershop_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_access"("p_barbershop_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_coupon_usage"("p_coupon_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_coupon_usage"("p_coupon_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_barbershop_active"("p_barbershop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_barbershop_admin"("p_barbershop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_barbershop_admin"("p_barbershop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_barbershop_member"("p_barbershop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_barbershop_member"("p_barbershop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barbershop_timezone"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_coupon"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_coupon"("p_code" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."validate_coupon"("p_code" "text") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addresses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."asaas_rate_limits" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."asaas_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."asaas_rate_limits" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."barber_availability" TO "anon";
GRANT ALL ON TABLE "public"."barber_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."barber_availability" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."barbers" TO "anon";
GRANT ALL ON TABLE "public"."barbers" TO "authenticated";
GRANT ALL ON TABLE "public"."barbers" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."barbershop_members" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."barbershop_members" TO "authenticated";
GRANT ALL ON TABLE "public"."barbershop_members" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."barbershops" TO "anon";
GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."barbershops" TO "authenticated";
GRANT ALL ON TABLE "public"."barbershops" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coupons" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."opening_hours" TO "anon";
GRANT ALL ON TABLE "public"."opening_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."opening_hours" TO "service_role";



GRANT ALL ON TABLE "public"."ops_alerts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ops_alerts_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."plans" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."public_barbershops" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."public_barbershops" TO "authenticated";
GRANT ALL ON TABLE "public"."public_barbershops" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."services" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."store_style" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."store_style" TO "authenticated";
GRANT ALL ON TABLE "public"."store_style" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."subscriptions" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."webhook_events" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







