


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


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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


CREATE OR REPLACE FUNCTION "public"."assert_appointment_read_access"("p_barbershop_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id AND bm.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;


ALTER FUNCTION "public"."assert_appointment_read_access"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_appointment_write_access"("p_barbershop_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Valida autenticação e permissão administrativa
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed'
      USING ERRCODE = '42501';
  END IF;

  -- Conta/barbearia desativada administrativamente
  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND b.is_active
  ) THEN
    RAISE EXCEPTION 'barbershop_inactive'
      USING ERRCODE = 'P0001';
  END IF;

  -- Assinatura fora do trial, período pago ou carência
  IF public.is_barbershop_active(p_barbershop_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'subscription_inactive'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;


ALTER FUNCTION "public"."assert_appointment_write_access"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_gallery"("p_barbershop_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.barbershops b
      where b.id::text = p_barbershop_id
        and (
          b.owner_id = (select auth.uid())
          or exists (
            select 1
            from public.barbershop_members bm
            where bm.barbershop_id = b.id
              and bm.user_id = (select auth.uid())
              and bm.role = 'admin'::public.member_role
          )
        )
    );
$$;


ALTER FUNCTION "public"."can_manage_gallery"("p_barbershop_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_manager_appointment_status"("p_appointment_id" "uuid", "p_expected_status" "text", "p_new_status" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_appointment_write_access(v_appointment.barbershop_id);

  IF v_appointment.status::text <> p_expected_status THEN
    RAISE EXCEPTION 'appointment_changed' USING ERRCODE = '40001';
  END IF;

  IF p_new_status = v_appointment.status::text THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = '22023';
  END IF;

  -- Agendamento ocorrido há mais de uma hora: permite ausência ou cancelado.
  IF v_appointment.starts_at < now() - interval '1 hour' THEN
    IF p_new_status NOT IN ('no_show', 'cancelled_by_barbershop') THEN
      RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = '22023';
    END IF;

  -- Agendamento com mais de uma hora no futuro: permite agendado ou cancelado.
  ELSIF v_appointment.starts_at > now() + interval '1 hour' THEN
    IF p_new_status NOT IN ('scheduled', 'cancelled_by_barbershop') THEN
      RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = '22023';
    END IF;

  -- Agendamento dentro da janela de uma hora antes ou depois do horário atual:
  -- os quatro status administrativos são aceitos.
  ELSIF p_new_status NOT IN (
    'scheduled', 'completed', 'no_show', 'cancelled_by_barbershop'
  ) THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = p_new_status::public.appointment_status
  WHERE id = p_appointment_id
  RETURNING * INTO v_appointment;

  RETURN jsonb_build_object('appointment', to_jsonb(v_appointment));
EXCEPTION
  -- Ao reativar um cancelado, preserva a proteção contra horários sobrepostos.
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23P01';
END;
$$;


ALTER FUNCTION "public"."change_manager_appointment_status"("p_appointment_id" "uuid", "p_expected_status" "text", "p_new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_email text := lower(BTRIM(COALESCE(p_email, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF char_length(v_email) > 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = v_email
  );
END;
$_$;


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


CREATE OR REPLACE FUNCTION "public"."create_customer"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_name text := NULLIF(BTRIM(COALESCE(p_name, '')), ''); -- Limpa o nome e transforma vazio em NULL.
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'); -- Persiste somente dígitos.
  v_customer public.customers%ROWTYPE; -- Receberá exatamente a linha inserida no banco.
  v_conflict jsonb;                  -- Receberá um cliente que já usa o telefone.
BEGIN
  IF auth.uid() IS NULL THEN          -- Não aceita criação sem sessão autenticada.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Retorna erro de autenticação padrão.
  END IF;

  IF NOT EXISTS (                     -- Confere permissão de escrita na barbearia.
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()       -- O proprietário pode criar clientes.
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text IN ('admin', 'writer') -- Reader pode consultar, mas não alterar.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; -- Bloqueia escrita sem papel autorizado.
  END IF;

  IF v_name IS NULL THEN              -- Nome é obrigatório depois da limpeza.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'name'); -- Permite mensagem específica na UI.
  END IF;
  IF length(v_phone) NOT IN (10, 11) THEN -- Aceita telefone brasileiro fixo ou celular com DDD.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'phone'); -- Impede telefone inválido no banco.
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_barbershop_id::text || ':' || v_phone, 0)
  );                                  -- Serializa create/update concorrentes para o mesmo telefone nesta barbearia.

  SELECT candidate.payload            -- Escolhe o cadastro conflitante mais apropriado.
  INTO v_conflict                     -- Salva o JSON para retorno imediato.
  FROM (                              -- Une possíveis conflitos manuais e autenticados.
    SELECT
      2 AS priority,                  -- Manual fica abaixo do autenticado na escolha canônica.
      c.created_at AS sort_date,
      jsonb_build_object(
        'id', c.id, 'barbershop_id', c.barbershop_id, 'name', c.name,
        'phone', c.phone, 'created_at', c.created_at, 'updated_at', c.updated_at,
        'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers',
        'total_appointments', 0, 'last_appointment', NULL
      ) AS payload
    FROM public.customers c           -- Procura cadastro manual na própria barbearia.
    WHERE c.barbershop_id = p_barbershop_id
      AND NOT COALESCE(c.auth, false)
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone -- Compara telefones normalizados.

    UNION ALL                         -- Também procura o mesmo telefone entre autenticados.

    SELECT
      1,                              -- Autenticado tem prioridade para evitar duplicação visual.
      MIN(COALESCE(a.created_at, c.created_at)),
      jsonb_build_object(
        'id', c.id, 'barbershop_id', p_barbershop_id, 'name', COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome'),
        'phone', c.phone, 'created_at', MIN(COALESCE(a.created_at, c.created_at)), 'updated_at', c.updated_at,
        'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers_auth',
        'total_appointments', COUNT(a.id)::integer, 'last_appointment', MAX(a.starts_at)
      )
    FROM public.appointments a        -- O agendamento prova o vínculo do autenticado com a loja.
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    GROUP BY c.id                     -- Consolida estatísticas do cliente autenticado.
  ) candidate
  ORDER BY candidate.priority, candidate.sort_date DESC -- Prioriza autenticado e depois o mais recente.
  LIMIT 1;                            -- Um conflito é suficiente para impedir a inserção.

  IF v_conflict IS NOT NULL THEN      -- Não cria uma segunda identidade com o mesmo telefone.
    RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict); -- Entrega o existente à UI.
  END IF;

  BEGIN                               -- Sub-bloco captura corrida de concorrência no insert.
    INSERT INTO public.customers (barbershop_id, name, phone) -- Insere somente campos permitidos.
    VALUES (p_barbershop_id, v_name, v_phone) -- Usa dados já validados e normalizados.
    RETURNING * INTO v_customer;      -- Obtém a fonte oficial criada pelo banco.
  EXCEPTION WHEN unique_violation THEN -- Outra requisição pode ter inserido o telefone simultaneamente.
    SELECT jsonb_build_object(
      'id', c.id, 'barbershop_id', c.barbershop_id, 'name', c.name,
      'phone', c.phone, 'created_at', c.created_at, 'updated_at', c.updated_at,
      'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers',
      'total_appointments', 0, 'last_appointment', NULL
    )
    INTO v_conflict
    FROM public.customers c
    WHERE c.barbershop_id = p_barbershop_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN    -- Converte violação esperada em resultado de negócio.
      RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict); -- Evita expor erro técnico.
    END IF;
    RAISE;                            -- Repropaga violações únicas que não sejam de telefone.
  END;

  RETURN jsonb_build_object(          -- Retorna a linha real, nunca uma cópia criada pelo frontend.
    'status', 'created',              -- Informa que a transação concluiu a criação.
    'customer', jsonb_build_object(
      'id', v_customer.id, 'barbershop_id', v_customer.barbershop_id,
      'name', v_customer.name, 'phone', v_customer.phone,
      'created_at', v_customer.created_at, 'updated_at', v_customer.updated_at,
      'auth', v_customer.auth, 'auth_user_id', v_customer.auth_user_id,
      'source', 'customers', 'total_appointments', 0, 'last_appointment', NULL -- Novo manual ainda não tem histórico.
    )
  );
END;                                  -- Finaliza create_customer.
$$;


ALTER FUNCTION "public"."create_customer"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_manager_appointments"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_customer_source" "text", "p_local_date" "date", "p_items" "jsonb", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_timezone text;
  v_customer_name text;
  v_item jsonb;
  v_service_id uuid;
  v_barber_id uuid;
  v_time_text text;
  v_local_time time;
  v_duration integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_service_name text;
  v_service_price numeric;
  v_barber_name text;
  v_slots jsonb;
  v_result jsonb;
BEGIN
  PERFORM public.assert_appointment_write_access(p_barbershop_id);

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'missing_idempotency_key' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 10 THEN
    RAISE EXCEPTION 'invalid_items' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text || ':' || p_idempotency_key::text, 0));

  SELECT jsonb_build_object('appointments', COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.starts_at), '[]'::jsonb))
  INTO v_result
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id AND a.booking_request_id = p_idempotency_key;

  IF jsonb_array_length(v_result->'appointments') > 0 THEN
    RETURN v_result;
  END IF;

  SELECT timezone INTO v_timezone FROM public.barbershops
  WHERE id = p_barbershop_id AND is_active;
  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'barbershop_inactive_or_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF p_customer_source = 'customers' THEN
    SELECT c.name INTO v_customer_name
    FROM public.customers c
    WHERE c.id = p_customer_id AND c.barbershop_id = p_barbershop_id AND NOT COALESCE(c.auth, false);
  ELSIF p_customer_source = 'customers_auth' THEN
    SELECT c.name INTO v_customer_name
    FROM public.customers c
    WHERE c.id = p_customer_id AND COALESCE(c.auth, false)
      AND EXISTS (
        SELECT 1 FROM public.appointments previous
        WHERE previous.barbershop_id = p_barbershop_id AND previous.customer_id = c.id
      );
  ELSE
    RAISE EXCEPTION 'invalid_customer_source' USING ERRCODE = '22023';
  END IF;

  IF v_customer_name IS NULL THEN
    RAISE EXCEPTION 'invalid_customer' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_service_id := (v_item->>'service_id')::uuid;
      v_barber_id := (v_item->>'barber_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_item_id' USING ERRCODE = '22023';
    END;

    v_time_text := v_item->>'time';
    IF v_time_text IS NULL OR v_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'invalid_time' USING ERRCODE = '22023';
    END IF;
    v_local_time := v_time_text::time;

    SELECT ROUND(s.duration_min)::integer, s.name, s.price, br.name
    INTO v_duration, v_service_name, v_service_price, v_barber_name
    FROM public.services s
    JOIN public.barber_services bs ON bs.service_id = s.id
    JOIN public.barbers br ON br.id = bs.barber_id
    WHERE s.id = v_service_id AND s.barbershop_id = p_barbershop_id AND s.is_active
      AND br.id = v_barber_id AND br.barbershop_id = p_barbershop_id AND br.is_active;

    IF v_duration IS NULL OR v_duration <= 0 THEN
      RAISE EXCEPTION 'invalid_service_or_barber' USING ERRCODE = 'P0001';
    END IF;

    v_slots := public.get_available_appointment_slots(
      p_barbershop_id, v_service_id, v_barber_id, p_local_date
    );
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_slots->'slots') slot
      WHERE slot->>'time' = v_time_text AND (slot->>'available')::boolean
    ) THEN
      RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23P01';
    END IF;

    v_starts_at := (p_local_date + v_local_time) AT TIME ZONE v_timezone;
    v_ends_at := v_starts_at + make_interval(mins => v_duration);

    INSERT INTO public.appointments (
      barbershop_id, customer_id, manual_customer_id, barber_id, service_id,
      starts_at, ends_at, status, customer_name, barber_name, service_name,
      service_price, service_duration, booking_request_id
    ) VALUES (
      p_barbershop_id,
      CASE WHEN p_customer_source = 'customers_auth' THEN p_customer_id ELSE NULL END,
      CASE WHEN p_customer_source = 'customers' THEN p_customer_id ELSE NULL END,
      v_barber_id, v_service_id, v_starts_at, v_ends_at,
      'scheduled'::public.appointment_status,
      v_customer_name, v_barber_name, v_service_name, v_service_price,
      v_duration, p_idempotency_key
    );
  END LOOP;

  SELECT jsonb_build_object(
    'appointments', COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.starts_at), '[]'::jsonb)
  ) INTO v_result
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id AND a.booking_request_id = p_idempotency_key;

  RETURN v_result;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23P01';
END;
$_$;


ALTER FUNCTION "public"."create_manager_appointments"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_customer_source" "text", "p_local_date" "date", "p_items" "jsonb", "p_idempotency_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.coupons
  set uses_count = greatest(uses_count - 1, 0)
  where id = p_coupon_id;
$$;


ALTER FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_customer public.customers%ROWTYPE; -- Guarda e bloqueia o cliente que será removido.
  v_future_count integer := 0;        -- Quantidade de agendamentos futuros ainda ativos.
BEGIN
  IF auth.uid() IS NULL THEN          -- Exige autenticação antes de qualquer consulta.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Bloqueia anônimos.
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text IN ('admin', 'writer') -- Reader não pode excluir.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_customer            -- Busca o cliente dentro do escopo autorizado.
  FROM public.customers c             -- Usa a fonte canônica.
  WHERE c.id = p_customer_id          -- Restringe ao ID solicitado.
    AND c.barbershop_id = p_barbershop_id -- Evita exclusão cruzada entre lojas.
    AND NOT COALESCE(c.auth, false)    -- Autenticados não podem ser apagados por este fluxo.
  FOR UPDATE;                         -- Mantém a linha bloqueada até o final da transação.

  IF NOT FOUND THEN                   -- Cliente inexistente, externo ou autenticado resulta igual.
    RETURN jsonb_build_object('status', 'not_found'); -- Não vaza dados de outra barbearia.
  END IF;

  SELECT COUNT(*)::integer            -- Conta somente vínculos que realmente impedem o delete.
  INTO v_future_count                 -- Salva a contagem para informar o modal.
  FROM public.appointments a          -- Consulta os agendamentos na mesma transação.
  WHERE a.barbershop_id = p_barbershop_id -- Restringe à loja autorizada.
    AND (
      a.manual_customer_id = p_customer_id   -- Vínculo esperado para cliente manual.
      OR a.customer_id = p_customer_id       -- Proteção defensiva para vínculos legados inconsistentes.
    )
    AND a.starts_at >= now()          -- Considera apenas horários presentes ou futuros.
    AND a.status::text NOT IN (
      'completed', 'cancelled_by_customer', 'cancelled_by_barbershop', 'no_show'
    );                                -- Estados encerrados não bloqueiam exclusão.

  IF v_future_count > 0 THEN          -- Regra crítica fica no banco, não no modal.
    RETURN jsonb_build_object(        -- Retorna conflito sem modificar nenhum dado.
      'status', 'conflict',           -- Status tratado pela UI.
      'reason', 'future_appointments', -- Motivo estável e reutilizável por outros clientes.
      'future_appointments', v_future_count -- Quantidade exibível na mensagem.
    );
  END IF;

  -- A checagem, a preservação do snapshot e o delete executam na mesma transação e sob o mesmo bloqueio.
  UPDATE public.appointments          -- Preserva os snapshots dos agendamentos antigos.
  SET manual_customer_id = NULL       -- Remove somente a chave estrangeira do cadastro apagado.
  WHERE barbershop_id = p_barbershop_id -- Mantém o escopo da barbearia.
    AND manual_customer_id = p_customer_id; -- Desvincula apenas este cliente.

  DELETE FROM public.customers        -- Apaga o cadastro depois de liberar vínculos históricos.
  WHERE id = p_customer_id            -- Restringe ao cliente bloqueado.
    AND barbershop_id = p_barbershop_id; -- Reforça a proteção de escopo no próprio delete.

  RETURN jsonb_build_object('status', 'deleted', 'customer_id', p_customer_id); -- Confirma o ID removido.
END;                                  -- Se qualquer instrução falhar, PostgreSQL desfaz toda a função.
$$;


ALTER FUNCTION "public"."delete_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_appointment_booking_context"("p_barbershop_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.assert_appointment_read_access(p_barbershop_id);

  SELECT jsonb_build_object(
    'timezone', b.timezone,
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_min', s.duration_min,
        'price', s.price, 'image_url', s.image_url, 'is_active', s.is_active
      ) ORDER BY s.name)
      FROM public.services s
      WHERE s.barbershop_id = b.id AND s.is_active
    ), '[]'::jsonb),
    'barbers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', br.id, 'name', br.name, 'avatar_url', br.avatar_url,
        'is_active', br.is_active
      ) ORDER BY br.name)
      FROM public.barbers br
      WHERE br.barbershop_id = b.id AND br.is_active
    ), '[]'::jsonb),
    'service_barbers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'service_id', bs.service_id, 'barber_id', bs.barber_id
      ))
      FROM public.barber_services bs
      JOIN public.services s ON s.id = bs.service_id AND s.barbershop_id = b.id AND s.is_active
      JOIN public.barbers br ON br.id = bs.barber_id AND br.barbershop_id = b.id AND br.is_active
    ), '[]'::jsonb),
    'opening_hours', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oh.id, 'barbershop_id', oh.barbershop_id,
        'day_of_week', oh.day_of_week, 'opens_at', oh.opens_at,
        'closes_at', oh.closes_at, 'is_open', oh.is_open,
        'period_order', oh.period_order
      ) ORDER BY oh.day_of_week, oh.period_order)
      FROM public.opening_hours oh
      WHERE oh.barbershop_id = b.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id AND b.is_active;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'barbershop_inactive_or_not_found' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_appointment_booking_context"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_appointment_slots"("p_barbershop_id" "uuid", "p_service_id" "uuid", "p_barber_id" "uuid", "p_local_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_timezone text;
  v_duration integer;
  v_day_of_week integer := EXTRACT(DOW FROM p_local_date)::integer;
  v_is_day_off boolean;
  v_has_custom_hours boolean;
  v_slots jsonb;
BEGIN
  PERFORM public.assert_appointment_read_access(p_barbershop_id);

  SELECT b.timezone, GREATEST(1, ROUND(s.duration_min)::integer)
  INTO v_timezone, v_duration
  FROM public.barbershops b
  JOIN public.services s ON s.barbershop_id = b.id
  JOIN public.barber_services bs ON bs.service_id = s.id
  JOIN public.barbers br ON br.id = bs.barber_id AND br.barbershop_id = b.id
  WHERE b.id = p_barbershop_id
    AND b.is_active AND s.id = p_service_id AND s.is_active
    AND br.id = p_barber_id AND br.is_active;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'invalid_service_or_barber' USING ERRCODE = 'P0001';
  END IF;

  IF p_local_date < (now() AT TIME ZONE v_timezone)::date THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb);
  END IF;

  SELECT
    COALESCE(bool_or(ba.is_day_off), false),
    COALESCE(bool_or(ba.use_custom_hours AND ba.starts_at IS NOT NULL AND ba.ends_at IS NOT NULL), false)
  INTO v_is_day_off, v_has_custom_hours
  FROM public.barber_availability ba
  WHERE ba.barbershop_id = p_barbershop_id
    AND ba.barber_id = p_barber_id
    AND ba.day_of_week = v_day_of_week;

  IF v_is_day_off THEN
    RETURN jsonb_build_object('slots', '[]'::jsonb);
  END IF;

  WITH shop_periods AS (
    SELECT oh.opens_at, oh.closes_at
    FROM public.opening_hours oh
    WHERE oh.barbershop_id = p_barbershop_id
      AND oh.day_of_week = v_day_of_week
      AND oh.is_open
  ),
  local_candidates AS (
    SELECT gs AS local_start
    FROM shop_periods sp
    CROSS JOIN LATERAL generate_series(
      p_local_date + sp.opens_at,
      p_local_date + sp.closes_at - make_interval(mins => v_duration),
      interval '30 minutes'
    ) gs
  ),
  valid_candidates AS (
    SELECT
      lc.local_start,
      lc.local_start AT TIME ZONE v_timezone AS starts_at,
      (lc.local_start + make_interval(mins => v_duration)) AT TIME ZONE v_timezone AS ends_at
    FROM local_candidates lc
    WHERE NOT v_has_custom_hours OR EXISTS (
      SELECT 1
      FROM public.barber_availability ba
      WHERE ba.barbershop_id = p_barbershop_id
        AND ba.barber_id = p_barber_id
        AND ba.day_of_week = v_day_of_week
        AND ba.use_custom_hours
        AND lc.local_start::time >= ba.starts_at
        AND (lc.local_start + make_interval(mins => v_duration))::time <= ba.ends_at
    )
  ),
  evaluated AS (
    SELECT
      to_char(vc.local_start, 'HH24:MI') AS slot_time,
      vc.starts_at > now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.barbershop_id = p_barbershop_id
          AND a.barber_id = p_barber_id
          AND a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop', 'no_show')
          AND a.starts_at < vc.ends_at
          AND a.ends_at > vc.starts_at
      ) AS available
    FROM valid_candidates vc
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('time', slot_time, 'available', available) ORDER BY slot_time),
    '[]'::jsonb
  ) INTO v_slots
  FROM evaluated;

  RETURN jsonb_build_object('slots', v_slots);
END;
$$;


ALTER FUNCTION "public"."get_available_appointment_slots"("p_barbershop_id" "uuid", "p_service_id" "uuid", "p_barber_id" "uuid", "p_local_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_barbershop_members"("p_barbershop_id" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "role" "public"."member_role", "username" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND b.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    bm.id,
    bm.user_id,
    bm.role,
    bm.username
  FROM public.barbershop_members bm
  WHERE bm.barbershop_id = p_barbershop_id
  ORDER BY lower(bm.username), bm.id;
END;
$$;


ALTER FUNCTION "public"."get_barbershop_members"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_history"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_source" "text", "p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1); -- Normaliza página inválida para 1.
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50); -- Limita resposta entre 1 e 50.
  v_total integer := 0;               -- Total completo de agendamentos do cliente.
  v_last timestamptz;                 -- Data do agendamento mais recente.
  v_items jsonb := '[]'::jsonb;       -- Itens da página atual.
BEGIN
  IF auth.uid() IS NULL THEN          -- Exige sessão autenticada.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Bloqueia anônimo.
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id AND bm.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_source NOT IN ('customers', 'customers_auth') THEN -- Impede coluna/origem arbitrária enviada pelo cliente.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'source'); -- Retorna erro de contrato.
  END IF;

  IF p_source = 'customers' AND NOT EXISTS ( -- Para manual, exige cadastro pertencente à loja.
    SELECT 1 FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.barbershop_id = p_barbershop_id
      AND NOT COALESCE(c.auth, false)
  ) THEN
    RETURN jsonb_build_object('status', 'not_found'); -- Não revela clientes de outra loja.
  END IF;

  IF p_source = 'customers_auth' AND NOT EXISTS ( -- Para autenticado, exige agendamento nesta loja.
    SELECT 1
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND a.customer_id = p_customer_id
  ) THEN
    RETURN jsonb_build_object('status', 'not_found'); -- Impede consultar histórico global do usuário.
  END IF;

  SELECT COUNT(*)::integer, MAX(a.starts_at) -- Calcula total e última data diretamente no banco.
  INTO v_total, v_last                -- Guarda estatísticas independentes da página.
  FROM public.appointments a          -- Consulta a tabela de agenda.
  WHERE a.barbershop_id = p_barbershop_id -- Mantém isolamento entre barbearias.
    AND (
      (p_source = 'customers' AND a.manual_customer_id = p_customer_id)
      OR (
        p_source = 'customers_auth'
        AND (
          a.customer_id = p_customer_id
          OR a.manual_customer_id IN ( -- Inclui histórico manual duplicado pelo mesmo telefone.
            SELECT manual_customer.id
            FROM public.customers manual_customer
            JOIN public.customers auth_customer ON auth_customer.id = p_customer_id
            WHERE manual_customer.barbershop_id = p_barbershop_id
              AND NOT COALESCE(manual_customer.auth, false)
              AND NULLIF(
                regexp_replace(COALESCE(manual_customer.phone, ''), '[^0-9]', '', 'g'),
                ''
              ) = NULLIF(
                regexp_replace(COALESCE(auth_customer.phone, ''), '[^0-9]', '', 'g'),
                ''
              )
          )
        )
      )
    );

  SELECT COALESCE(                    -- Agrega a página em um array JSON sempre válido.
    jsonb_agg(row_payload ORDER BY starts_at DESC, id DESC),
    '[]'::jsonb
  )
  INTO v_items                        -- Guarda os itens paginados para o retorno.
  FROM (                              -- Subconsulta monta cada agendamento já pronto para a UI.
    SELECT
      a.id,
      a.starts_at,
      jsonb_build_object(
        'id', a.id,                   -- Identificador do agendamento.
        'starts_at', a.starts_at,     -- Data/hora exibida no histórico.
        'status', a.status,           -- Estado usado pelo badge da UI.
        'service_name', COALESCE(a.service_name, s.name, 'Serviço removido'), -- Prioriza snapshot e cria fallback.
        'barber_name', COALESCE(a.barber_name, b.name) -- Prioriza snapshot e depois relação atual.
      ) AS row_payload
    FROM public.appointments a        -- Parte do registro histórico principal.
    LEFT JOIN public.services s       -- Serviço pode ter sido removido, por isso LEFT JOIN.
      ON s.id = a.service_id AND s.barbershop_id = a.barbershop_id -- Impede relação cruzada.
    LEFT JOIN public.barbers b        -- Profissional também pode ter sido removido.
      ON b.id = a.barber_id AND b.barbershop_id = a.barbershop_id -- Mantém escopo da loja.
    WHERE a.barbershop_id = p_barbershop_id -- Filtra a barbearia autorizada.
      AND (
        (p_source = 'customers' AND a.manual_customer_id = p_customer_id)
        OR (
          p_source = 'customers_auth'
          AND (
            a.customer_id = p_customer_id
            OR a.manual_customer_id IN (
              SELECT manual_customer.id
              FROM public.customers manual_customer
              JOIN public.customers auth_customer ON auth_customer.id = p_customer_id
              WHERE manual_customer.barbershop_id = p_barbershop_id
                AND NOT COALESCE(manual_customer.auth, false)
                AND NULLIF(
                  regexp_replace(COALESCE(manual_customer.phone, ''), '[^0-9]', '', 'g'),
                  ''
                ) = NULLIF(
                  regexp_replace(COALESCE(auth_customer.phone, ''), '[^0-9]', '', 'g'),
                  ''
                )
            )
          )
        )
      )
    ORDER BY a.starts_at DESC, a.id DESC -- Mostra mais recentes primeiro com desempate estável.
    LIMIT v_page_size                 -- Retorna somente 10 por padrão e no máximo 50.
    OFFSET (v_page - 1) * v_page_size -- Permite acessar todas as páginas do histórico.
  ) history_rows;

  RETURN jsonb_build_object(          -- Monta o contrato consumido pelo modal.
    'status', 'ok',                   -- Confirma uma consulta válida, inclusive quando vazia.
    'items', v_items,                 -- Agendamentos da página atual.
    'total', v_total,                 -- Total completo para o resumo.
    'last_appointment', v_last,       -- Última data independentemente da página aberta.
    'page', v_page,                   -- Página efetivamente usada.
    'page_size', v_page_size,         -- Quantidade máxima aplicada.
    'total_pages', CASE WHEN v_total = 0 THEN 0 ELSE CEIL(v_total::numeric / v_page_size)::integer END -- Páginas navegáveis.
  );
END;                                  -- Finaliza get_customer_history.
$$;


ALTER FUNCTION "public"."get_customer_history"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_source" "text", "p_page" integer, "p_page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customers"("p_barbershop_id" "uuid", "p_search" "text" DEFAULT NULL::"text", "p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 20) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1); -- Impede página nula, zero ou negativa.
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100); -- Mantém o tamanho entre 1 e 100.
  v_search text := NULLIF(BTRIM(COALESCE(p_search, '')), ''); -- Remove espaços e converte busca vazia em NULL.
  v_search_phone text;              -- Guardará somente os dígitos pesquisados.
  v_search_pattern text;            -- Padrão textual com curingas do usuário escapados.
  v_total integer := 0;             -- Total de clientes após busca e deduplicação.
  v_items jsonb := '[]'::jsonb;     -- Lista da página atual; começa vazia.
BEGIN
  IF auth.uid() IS NULL THEN         -- Confirma que existe uma sessão Supabase válida.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Interrompe usuários anônimos.
  END IF;

  IF NOT EXISTS (                    -- Exige vínculo do usuário com a barbearia informada.
    SELECT 1                         -- Basta saber se um registro autorizado existe.
    FROM public.barbershops b        -- Consulta a barbearia real, sem confiar no frontend.
    WHERE b.id = p_barbershop_id     -- Restringe a validação ao ID recebido.
      AND (
        b.owner_id = auth.uid()      -- O proprietário sempre pode ler.
        OR EXISTS (                  -- Caso não seja owner, procura uma associação de membro.
          SELECT 1
          FROM public.barbershop_members bm -- Tabela que liga usuários às barbearias.
          WHERE bm.barbershop_id = b.id     -- A associação deve ser desta barbearia.
            AND bm.user_id = auth.uid()     -- E deve pertencer ao usuário autenticado.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; -- Recusa acesso cruzado entre barbearias.
  END IF;

  v_search_phone := NULLIF(regexp_replace(COALESCE(v_search, ''), '[^0-9]', '', 'g'), ''); -- Normaliza a busca telefônica.
  v_search_pattern := CASE
    WHEN v_search IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(v_search, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
  END;                               -- Faz % e _ digitados pelo usuário valerem como texto, não como curingas.

  WITH manual_customers AS (         -- Primeiro conjunto: clientes manuais desta barbearia.
    SELECT
      c.id,                           -- Identificador do cliente.
      c.barbershop_id,                -- Barbearia dona do cadastro manual.
      c.name,                         -- Nome persistido no banco.
      c.phone,                        -- Telefone persistido já normalizado.
      c.created_at,                   -- Data de criação usada na ordenação.
      c.updated_at,                   -- Data da última atualização.
      c.auth,                         -- Indica se o registro tem autenticação própria.
      c.auth_user_id,                 -- Usuário autenticado associado, quando existir.
      'customers'::text AS source,    -- Padroniza a origem consumida pela UI.
      COUNT(a.id) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS total_appointments, -- Conta agendamentos não cancelados no próprio SQL.
      MAX(a.starts_at) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      ) AS last_appointment           -- Localiza o agendamento mais recente não cancelado.
    FROM public.customers c           -- Parte da tabela canônica de clientes.
    LEFT JOIN public.appointments a   -- Mantém clientes que ainda não possuem agendamentos.
      ON a.barbershop_id = p_barbershop_id -- Impede contabilizar agendamentos de outra barbearia.
     AND a.manual_customer_id = c.id  -- Usa o vínculo destinado ao cliente manual.
    WHERE c.barbershop_id = p_barbershop_id -- Retorna somente cadastros desta barbearia.
      AND NOT COALESCE(c.auth, false) -- Exclui autenticados deste primeiro conjunto.
    GROUP BY c.id                     -- Produz uma linha agregada por cliente.
  ),
  authenticated_customers AS (       -- Segundo conjunto: clientes autenticados que agendaram aqui.
    SELECT
      c.id,                           -- ID global do cliente autenticado.
      p_barbershop_id AS barbershop_id, -- Projeta a barbearia consultada para o contrato da UI.
      COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome') AS name, -- Garante nome exibível.
      c.phone,                        -- Telefone verificado do cliente autenticado.
      MIN(COALESCE(a.created_at, c.created_at)) AS created_at, -- Primeira aparição nesta barbearia.
      c.updated_at,                   -- Última atualização do cadastro.
      c.auth,                         -- Mantém a informação de autenticação.
      c.auth_user_id,                 -- Mantém o usuário correspondente.
      'customers_auth'::text AS source, -- Origem padronizada para a UI.
      COUNT(a.id) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS total_appointments, -- Conta visitas não canceladas nesta barbearia.
      MAX(a.starts_at) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      ) AS last_appointment           -- Obtém a visita mais recente não cancelada.
    FROM public.appointments a        -- O vínculo com a barbearia nasce do agendamento.
    JOIN public.customers c           -- Recupera os dados atuais do cliente autenticado.
      ON c.id = a.customer_id         -- Usa o vínculo de cliente autenticado.
     AND COALESCE(c.auth, false)      -- Confirma que ele realmente é autenticado.
    WHERE a.barbershop_id = p_barbershop_id -- Restringe os agendamentos à barbearia consultada.
      AND a.customer_id IS NOT NULL   -- Ignora agendamentos sem cliente autenticado.
    GROUP BY c.id                     -- Gera uma linha por cliente autenticado.
  ),
  merged AS (                         -- Une os dois formatos em um contrato único.
    SELECT * FROM manual_customers    -- Inclui todos os clientes manuais.
    UNION ALL                         -- Evita custo de deduplicação aqui; ela será controlada abaixo.
    SELECT * FROM authenticated_customers -- Inclui clientes autenticados com histórico na loja.
  ),
  ranked AS (                         -- Agrupa identidades pelo telefone normalizado.
    SELECT
      m.*,
      SUM(m.total_appointments) OVER (PARTITION BY
        COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
      )::integer AS combined_total_appointments, -- Soma o histórico manual e autenticado duplicado.
      MAX(m.last_appointment) OVER (PARTITION BY
        COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
      ) AS combined_last_appointment, -- Mantém a data mais recente entre as possíveis duplicatas.
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
        ORDER BY CASE WHEN m.source = 'customers_auth' THEN 0 ELSE 1 END,
                 m.created_at DESC,
                 m.id DESC
      ) AS identity_rank              -- Marca como 1 o registro canônico que será exibido.
    FROM merged m                     -- Aplica as janelas sobre as duas origens já unificadas.
  ),
  deduplicated AS (                   -- Remove duplicidade manual/autenticada do resultado visual.
    SELECT
      id, barbershop_id, name, phone, created_at, updated_at, auth,
      auth_user_id, source,
      combined_total_appointments AS total_appointments,
      combined_last_appointment AS last_appointment
    FROM ranked                       -- Usa os resultados calculados pela etapa anterior.
    WHERE identity_rank = 1           -- Mantém apenas uma identidade; autenticado tem prioridade.
  ),
  filtered AS (                       -- Aplica busca antes de contar e paginar.
    SELECT *
    FROM deduplicated m
    WHERE v_search IS NULL            -- Sem texto, todos os clientes permanecem elegíveis.
       OR m.name ILIKE v_search_pattern ESCAPE E'\\' -- Busca nome literalmente, sem diferenciar maiúsculas/minúsculas.
       OR (v_search_phone IS NOT NULL AND COALESCE(m.phone, '') LIKE '%' || v_search_phone || '%') -- Busca dígitos do telefone.
  ),
  counted AS (                        -- Calcula o total sem uma consulta separada na página válida.
    SELECT f.*, COUNT(*) OVER ()::integer AS full_count -- Repete o total em cada linha paginada.
    FROM filtered f                   -- Conta somente os resultados da busca atual.
  ),
  paged AS (                          -- Recorta somente os registros solicitados pelo navegador.
    SELECT *
    FROM counted
    ORDER BY created_at DESC, id DESC -- Ordenação estável: mais novos primeiro e ID como desempate.
    LIMIT v_page_size                 -- Nunca envia mais que o tamanho validado da página.
    OFFSET (v_page - 1) * v_page_size -- Pula exatamente as páginas anteriores.
  )
  SELECT
    COALESCE(MAX(full_count), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'barbershop_id', barbershop_id,
          'name', name,
          'phone', phone,
          'created_at', created_at,
          'updated_at', updated_at,
          'auth', auth,
          'auth_user_id', auth_user_id,
          'source', source,
          'total_appointments', total_appointments,
          'last_appointment', last_appointment
        )
        ORDER BY created_at DESC, id DESC
      ),
      '[]'::jsonb
    )
  INTO v_total, v_items               -- Salva a contagem e a lista nas variáveis de retorno.
  FROM paged;                         -- Agrega exclusivamente a página atual.

  -- An empty page has no window row from which to read the total.
  IF v_total = 0 AND v_page > 1 THEN  -- Trata página além do fim, onde a janela não possui linhas.
    WITH manual_ids AS (
      SELECT c.id, c.name, c.phone
      FROM public.customers c
      WHERE c.barbershop_id = p_barbershop_id
        AND NOT COALESCE(c.auth, false)
    ),
    auth_ids AS (
      SELECT DISTINCT c.id, COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome') AS name, c.phone
      FROM public.appointments a
      JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
      WHERE a.barbershop_id = p_barbershop_id
    ),
    all_ids AS (
      SELECT *, COALESCE(
        NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), ''),
        'id:' || id::text
      ) AS identity_key FROM manual_ids
      UNION ALL
      SELECT *, COALESCE(
        NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), ''),
        'id:' || id::text
      ) AS identity_key FROM auth_ids
    )
    SELECT COUNT(DISTINCT identity_key)::integer -- Recalcula apenas o total deduplicado.
    INTO v_total                      -- Preserva total_pages mesmo quando a página está vazia.
    FROM all_ids m
    WHERE v_search IS NULL
       OR m.name ILIKE v_search_pattern ESCAPE E'\\'
       OR (v_search_phone IS NOT NULL AND COALESCE(m.phone, '') LIKE '%' || v_search_phone || '%');
  END IF;

  RETURN jsonb_build_object(          -- Monta o contrato final consumido pelo hook React.
    'items', v_items,                 -- Clientes da página atual.
    'total', v_total,                 -- Quantidade total encontrada no banco.
    'page', v_page,                   -- Página efetivamente utilizada.
    'page_size', v_page_size,         -- Limite efetivamente aplicado.
    'total_pages', CASE WHEN v_total = 0 THEN 0 ELSE CEIL(v_total::numeric / v_page_size)::integer END -- Número navegável de páginas.
  );
END;                                  -- Finaliza a lógica de get_customers.
$$;


ALTER FUNCTION "public"."get_customers"("p_barbershop_id" "uuid", "p_search" "text", "p_page" integer, "p_page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_summary"("p_barbershop_id" "uuid", "p_for_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_timezone text;
  v_today date;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_month_start timestamptz;
  v_next_month_start timestamptz;
  v_today_appointments jsonb := '[]'::jsonb;
  v_hourly_data jsonb := '[]'::jsonb;
  v_top_services jsonb := '[]'::jsonb;
  v_month_revenue numeric := 0;
  v_completed_today integer := 0;
  v_total_customers integer := 0;
  v_new_customers_this_month integer := 0;
  v_active_services integer := 0;
  v_active_professionals integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT b.timezone
    INTO v_timezone
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id
    AND (
      b.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.barbershop_members bm
        WHERE bm.barbershop_id = p_barbershop_id
          AND bm.user_id = auth.uid()
      )
    );

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  v_today := COALESCE(p_for_date, (now() AT TIME ZONE v_timezone)::date);
  v_today_start := v_today::timestamp AT TIME ZONE v_timezone;
  v_today_end := (v_today + 1)::timestamp AT TIME ZONE v_timezone;
  v_month_start := date_trunc('month', v_today::timestamp) AT TIME ZONE v_timezone;
  v_next_month_start :=
    (date_trunc('month', v_today::timestamp) + interval '1 month') AT TIME ZONE v_timezone;

  SELECT COALESCE(
    jsonb_agg(appointment_payload ORDER BY starts_at),
    '[]'::jsonb
  )
    INTO v_today_appointments
  FROM (
    SELECT
      a.starts_at,
      jsonb_build_object(
        'id', a.id,
        'barbershop_id', a.barbershop_id,
        'customer_id', a.customer_id,
        'manual_customer_id', a.manual_customer_id,
        'barber_id', a.barber_id,
        'service_id', a.service_id,
        'service_name', a.service_name,
        'service_price', a.service_price,
        'service_duration_min', s.duration_min,
        'barber_name', a.barber_name,
        'customer_name', a.customer_name,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'status', a.status,
        'notes', a.notes,
        'created_at', a.created_at,
        'customer', NULL,
        'barber', NULL,
        'service', NULL
      ) AS appointment_payload
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_today_start
      AND a.starts_at < v_today_end
  ) today_rows;

  SELECT COALESCE(SUM(a.service_price), 0)
    INTO v_month_revenue
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id
    AND a.starts_at >= v_month_start
    AND a.starts_at < v_next_month_start
    AND a.status = 'completed';

  SELECT COUNT(*)::integer
    INTO v_completed_today
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id
    AND a.starts_at >= v_today_start
    AND a.starts_at < v_today_end
    AND a.status = 'completed';

  WITH hourly_counts AS (
    SELECT
      EXTRACT(HOUR FROM a.starts_at AT TIME ZONE v_timezone)::integer AS hour_index,
      COUNT(*) FILTER (WHERE a.status = 'completed')::integer AS concluido,
      COUNT(*) FILTER (
        WHERE a.status IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS cancelado,
      COUNT(*) FILTER (
        WHERE a.status NOT IN (
          'completed',
          'cancelled_by_customer',
          'cancelled_by_barbershop'
        )
      )::integer AS agendado
    FROM public.appointments a
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_today_start
      AND a.starts_at < v_today_end
    GROUP BY hour_index
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'hour', LPAD(hours.hour_index::text, 2, '0') || ':00',
        'concluido', COALESCE(hourly_counts.concluido, 0),
        'agendado', COALESCE(hourly_counts.agendado, 0),
        'cancelado', COALESCE(hourly_counts.cancelado, 0)
      )
      ORDER BY hours.hour_index
    ),
    '[]'::jsonb
  )
    INTO v_hourly_data
  FROM generate_series(0, 23) AS hours(hour_index)
  LEFT JOIN hourly_counts ON hourly_counts.hour_index = hours.hour_index;

  WITH merged_customers AS (
    SELECT customer_id, MIN(first_seen_at) AS first_seen_at
    FROM (
      SELECT
        c.id AS customer_id,
        c.created_at AS first_seen_at
      FROM public.customers c
      WHERE c.barbershop_id = p_barbershop_id

      UNION ALL

      SELECT
        c.id AS customer_id,
        MIN(COALESCE(a.created_at, c.created_at)) AS first_seen_at
      FROM public.appointments a
      JOIN public.customers c ON c.id = a.customer_id
      WHERE a.barbershop_id = p_barbershop_id
        AND a.customer_id IS NOT NULL
        AND c.auth = true
      GROUP BY c.id
    ) source_customers
    GROUP BY customer_id
  )
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (
      WHERE first_seen_at >= v_month_start
        AND first_seen_at < v_next_month_start
    )::integer
  INTO v_total_customers, v_new_customers_this_month
  FROM merged_customers;

  SELECT COUNT(*)::integer
    INTO v_active_services
  FROM public.services s
  WHERE s.barbershop_id = p_barbershop_id
    AND s.is_active = true;

  SELECT COUNT(*)::integer
    INTO v_active_professionals
  FROM public.barbers b
  WHERE b.barbershop_id = p_barbershop_id
    AND b.is_active = true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('name', service_name, 'count', service_count)
      ORDER BY service_count DESC, service_name
    ),
    '[]'::jsonb
  )
    INTO v_top_services
  FROM (
    SELECT
      a.service_name,
      COUNT(*)::integer AS service_count
    FROM public.appointments a
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_month_start
      AND a.starts_at < v_next_month_start
      AND a.status = 'completed'
      AND a.service_name IS NOT NULL
    GROUP BY a.service_name
    ORDER BY COUNT(*) DESC, a.service_name
    LIMIT 5
  ) service_counts;

  RETURN jsonb_build_object(
    'today_appointments', v_today_appointments,
    'month_revenue', v_month_revenue,
    'completed_today', v_completed_today,
    'total_customers', v_total_customers,
    'new_customers_this_month', v_new_customers_this_month,
    'active_services', v_active_services,
    'active_professionals', v_active_professionals,
    'hourly_data', v_hourly_data,
    'top_services', v_top_services
  );
END;
$$;


ALTER FUNCTION "public"."get_dashboard_summary"("p_barbershop_id" "uuid", "p_for_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_dashboard_summary"("p_barbershop_id" "uuid", "p_for_date" "date") IS 'Returns authorized, aggregated dashboard data for one barbershop.';



CREATE OR REPLACE FUNCTION "public"."get_manager_appointments"("p_barbershop_id" "uuid", "p_from_date" "date", "p_to_date_exclusive" "date", "p_limit" integer DEFAULT 5000) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_timezone text;
  v_from timestamptz;
  v_to timestamptz;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 5000);
  v_items jsonb;
BEGIN
  PERFORM public.assert_appointment_read_access(p_barbershop_id);

  IF p_from_date IS NULL OR p_to_date_exclusive IS NULL
     OR p_to_date_exclusive <= p_from_date
     OR p_to_date_exclusive - p_from_date > 370 THEN
    RAISE EXCEPTION 'invalid_date_range' USING ERRCODE = '22023';
  END IF;

  SELECT timezone INTO v_timezone FROM public.barbershops WHERE id = p_barbershop_id;
  v_from := p_from_date::timestamp AT TIME ZONE v_timezone;
  v_to := p_to_date_exclusive::timestamp AT TIME ZONE v_timezone;

  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.starts_at), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      a.id, a.barbershop_id, a.customer_id, a.manual_customer_id,
      a.barber_id, a.service_id, a.starts_at, a.ends_at,
      a.status, a.notes, a.created_at,
      COALESCE(NULLIF(a.customer_name, ''), c.name, 'Cliente sem nome') AS customer_name,
      COALESCE(NULLIF(a.barber_name, ''), br.name) AS barber_name,
      COALESCE(NULLIF(a.service_name, ''), s.name) AS service_name,
      COALESCE(a.service_price, s.price) AS service_price,
      COALESCE(a.service_duration, ROUND(s.duration_min)::integer) AS service_duration_min,
      CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', c.id, 'name', COALESCE(NULLIF(c.name, ''), 'Cliente sem nome'),
        'phone', c.phone,
        'source', CASE WHEN COALESCE(c.auth, false) THEN 'customers_auth' ELSE 'customers' END
      ) END AS customer,
      CASE WHEN br.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', br.id, 'name', br.name, 'avatar_url', br.avatar_url
      ) END AS barber,
      CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_min', s.duration_min, 'price', s.price
      ) END AS service
    FROM public.appointments a
    LEFT JOIN public.customers c ON c.id = COALESCE(a.customer_id, a.manual_customer_id)
    LEFT JOIN public.barbers br ON br.id = a.barber_id
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_from
      AND a.starts_at < v_to
    ORDER BY a.starts_at
    LIMIT v_limit
  ) row_data;

  RETURN jsonb_build_object('items', v_items, 'timezone', v_timezone);
END;
$$;


ALTER FUNCTION "public"."get_manager_appointments"("p_barbershop_id" "uuid", "p_from_date" "date", "p_to_date_exclusive" "date", "p_limit" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_reports_summary"("p_barbershop_id" "uuid", "p_from" "date", "p_to" "date", "p_barber_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_timezone text;
  v_range_start timestamptz;
  v_range_end timestamptz;
  v_total integer := 0;
  v_completed integer := 0;
  v_cancelled integer := 0;
  v_no_show integer := 0;
  v_completion_rate integer := 0;
  v_revenue numeric := 0;
  v_avg_ticket numeric := 0;
  v_new_customers integer := 0;
  v_worked_minutes numeric := 0;
  v_unique_customers integer := 0;
  v_hourly_data jsonb := '[]'::jsonb;
  v_barbers_data jsonb := '[]'::jsonb;
  v_services_data jsonb := '[]'::jsonb;
  v_weekday_data jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = '22007';
  END IF;

  SELECT b.timezone
    INTO v_timezone
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id
    AND (
      b.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.barbershop_members bm
        WHERE bm.barbershop_id = p_barbershop_id
          AND bm.user_id = auth.uid()
      )
    );

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_barber_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.id = p_barber_id
      AND b.barbershop_id = p_barbershop_id
  ) THEN
    RAISE EXCEPTION 'invalid_barber' USING ERRCODE = '42501';
  END IF;

  v_range_start := p_from::timestamp AT TIME ZONE v_timezone;
  v_range_end := (p_to + 1)::timestamp AT TIME ZONE v_timezone;

  WITH filtered_appointments AS (
    SELECT
      a.id,
      a.starts_at,
      a.status,
      a.customer_id,
      a.barber_id,
      COALESCE(a.barber_name, b.name, 'Sem profissional') AS barber_name,
      COALESCE(a.service_name, s.name, 'Sem serviço') AS service_name,
      COALESCE(a.service_price, s.price, 0) AS service_price,
      COALESCE(s.duration_min, 0) AS duration_min
    FROM public.appointments a
    LEFT JOIN public.barbers b
      ON b.id = a.barber_id
     AND b.barbershop_id = a.barbershop_id
    LEFT JOIN public.services s
      ON s.id = a.service_id
     AND s.barbershop_id = a.barbershop_id
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_range_start
      AND a.starts_at < v_range_end
      AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
  )
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE status = 'completed')::integer,
    COUNT(*) FILTER (
      WHERE status IN ('cancelled_by_customer', 'cancelled_by_barbershop')
    )::integer,
    COUNT(*) FILTER (WHERE status = 'no_show')::integer,
    COALESCE(SUM(service_price) FILTER (WHERE status = 'completed'), 0),
    COALESCE(AVG(service_price) FILTER (WHERE status = 'completed'), 0),
    COALESCE(SUM(duration_min) FILTER (WHERE status = 'completed'), 0),
    COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL)::integer
  INTO
    v_total,
    v_completed,
    v_cancelled,
    v_no_show,
    v_revenue,
    v_avg_ticket,
    v_worked_minutes,
    v_unique_customers
  FROM filtered_appointments;

  v_completion_rate :=
    CASE WHEN v_total > 0 THEN ROUND((v_completed::numeric / v_total) * 100)::integer ELSE 0 END;

  WITH merged_customers AS (
    SELECT customer_id, MIN(first_seen_at) AS first_seen_at
    FROM (
      SELECT
        c.id AS customer_id,
        c.created_at AS first_seen_at
      FROM public.customers c
      WHERE c.barbershop_id = p_barbershop_id

      UNION ALL

      SELECT
        c.id AS customer_id,
        MIN(COALESCE(a.created_at, c.created_at)) AS first_seen_at
      FROM public.appointments a
      JOIN public.customers c ON c.id = a.customer_id
      WHERE a.barbershop_id = p_barbershop_id
        AND a.customer_id IS NOT NULL
        AND c.auth = true
      GROUP BY c.id
    ) source_customers
    GROUP BY customer_id
  )
  SELECT COUNT(*)::integer
    INTO v_new_customers
  FROM merged_customers
  WHERE first_seen_at >= v_range_start
    AND first_seen_at < v_range_end;

  WITH filtered_appointments AS (
    SELECT
      EXTRACT(HOUR FROM a.starts_at AT TIME ZONE v_timezone)::integer AS hour_index,
      a.status
    FROM public.appointments a
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_range_start
      AND a.starts_at < v_range_end
      AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
  ),
  hourly_counts AS (
    SELECT
      hour_index,
      COUNT(*) FILTER (WHERE status = 'completed')::integer AS concluido,
      COUNT(*) FILTER (
        WHERE status IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS cancelado,
      COUNT(*) FILTER (
        WHERE status NOT IN (
          'completed',
          'cancelled_by_customer',
          'cancelled_by_barbershop'
        )
      )::integer AS agendado
    FROM filtered_appointments
    GROUP BY hour_index
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'hour', LPAD(hours.hour_index::text, 2, '0') || ':00',
        'concluido', COALESCE(hourly_counts.concluido, 0),
        'agendado', COALESCE(hourly_counts.agendado, 0),
        'cancelado', COALESCE(hourly_counts.cancelado, 0)
      )
      ORDER BY hours.hour_index
    ),
    '[]'::jsonb
  )
    INTO v_hourly_data
  FROM generate_series(0, 23) AS hours(hour_index)
  LEFT JOIN hourly_counts ON hourly_counts.hour_index = hours.hour_index;

  WITH barber_counts AS (
    SELECT
      COALESCE(a.barber_name, b.name, 'Sem profissional') AS name,
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE a.status = 'completed')::integer AS completed
    FROM public.appointments a
    LEFT JOIN public.barbers b
      ON b.id = a.barber_id
     AND b.barbershop_id = a.barbershop_id
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_range_start
      AND a.starts_at < v_range_end
      AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
    GROUP BY COALESCE(a.barber_name, b.name, 'Sem profissional')
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('name', name, 'total', total, 'completed', completed)
      ORDER BY total DESC, name
    ),
    '[]'::jsonb
  )
    INTO v_barbers_data
  FROM barber_counts;

  WITH service_counts AS (
    SELECT
      COALESCE(a.service_name, s.name, 'Sem serviço') AS name,
      COUNT(*)::integer AS total
    FROM public.appointments a
    LEFT JOIN public.services s
      ON s.id = a.service_id
     AND s.barbershop_id = a.barbershop_id
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_range_start
      AND a.starts_at < v_range_end
      AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
      AND a.status = 'completed'
    GROUP BY COALESCE(a.service_name, s.name, 'Sem serviço')
    ORDER BY COUNT(*) DESC, COALESCE(a.service_name, s.name, 'Sem serviço')
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('name', name, 'total', total) ORDER BY total DESC, name),
    '[]'::jsonb
  )
    INTO v_services_data
  FROM service_counts;

  WITH weekday_counts AS (
    SELECT
      EXTRACT(DOW FROM a.starts_at AT TIME ZONE v_timezone)::integer AS weekday_index,
      COUNT(*)::integer AS total
    FROM public.appointments a
    WHERE a.barbershop_id = p_barbershop_id
      AND a.starts_at >= v_range_start
      AND a.starts_at < v_range_end
      AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
      AND a.status NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
    GROUP BY weekday_index
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'day',
        CASE days.weekday_index
          WHEN 0 THEN 'Dom'
          WHEN 1 THEN 'Seg'
          WHEN 2 THEN 'Ter'
          WHEN 3 THEN 'Qua'
          WHEN 4 THEN 'Qui'
          WHEN 5 THEN 'Sex'
          ELSE 'Sáb'
        END,
        'total', COALESCE(weekday_counts.total, 0)
      )
      ORDER BY days.weekday_index
    ),
    '[]'::jsonb
  )
    INTO v_weekday_data
  FROM generate_series(0, 6) AS days(weekday_index)
  LEFT JOIN weekday_counts ON weekday_counts.weekday_index = days.weekday_index;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'total', v_total,
      'completed', v_completed,
      'cancelled', v_cancelled,
      'no_show', v_no_show,
      'completion_rate', v_completion_rate,
      'revenue', v_revenue,
      'avg_ticket', v_avg_ticket,
      'new_customers', v_new_customers,
      'worked_minutes', v_worked_minutes,
      'unique_customers', v_unique_customers
    ),
    'hourly_data', v_hourly_data,
    'barbers_data', v_barbers_data,
    'services_data', v_services_data,
    'weekday_data', v_weekday_data
  );
END;
$$;


ALTER FUNCTION "public"."get_reports_summary"("p_barbershop_id" "uuid", "p_from" "date", "p_to" "date", "p_barber_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_reports_summary"("p_barbershop_id" "uuid", "p_from" "date", "p_to" "date", "p_barber_id" "uuid") IS 'Returns authorized, aggregated reports data for one barbershop and period.';



CREATE OR REPLACE FUNCTION "public"."get_settings_alerts"("p_barbershop_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_owner_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT p.name
  INTO v_owner_name
  FROM public.barbershops b
  JOIN public.profiles p ON p.id = b.owner_id
  WHERE b.id = p_barbershop_id
    AND (
      b.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.barbershop_members bm
        WHERE bm.barbershop_id = b.id
          AND bm.user_id = auth.uid()
          AND bm.role::text = 'admin'
      )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'missing_address', NOT EXISTS (
      SELECT 1 FROM public.addresses a
      WHERE a.barbershop_id = p_barbershop_id
    ),
    'missing_hours', NOT EXISTS (
      SELECT 1 FROM public.opening_hours oh
      WHERE oh.barbershop_id = p_barbershop_id
        AND oh.is_open = true
    ),
    'owner_name', v_owner_name
  );
END;
$$;


ALTER FUNCTION "public"."get_settings_alerts"("p_barbershop_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."mark_overdue_appointments_as_no_show"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_updated_count integer;
BEGIN
  UPDATE public.appointments
  SET
    status = 'no_show'::public.appointment_status,
    updated_at = now()
  WHERE status = 'scheduled'::public.appointment_status
    AND starts_at < now() - interval '1 hour';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_overdue_appointments_as_no_show"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_barbershop_member"("p_owner_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_username" "text", "p_role" "text", "p_max_members" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_member public.barbershop_members%ROWTYPE;
  v_username text := lower(BTRIM(COALESCE(p_username, '')));
BEGIN
  IF v_username !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF p_role NOT IN ('admin', 'reader') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  IF p_max_members IS NULL OR p_max_members < 1 OR p_max_members > 1000 THEN
    RAISE EXCEPTION 'invalid_member_limit' USING ERRCODE = '22023';
  END IF;

  -- O lock serializa criacoes na mesma barbearia. Assim, duas requisicoes
  -- concorrentes nao conseguem ultrapassar o limite de membros.
  PERFORM 1
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id
    AND b.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_barbershop_owner' USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*)
    FROM public.barbershop_members bm
    WHERE bm.barbershop_id = p_barbershop_id
  ) >= p_max_members THEN
    RAISE EXCEPTION 'member_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profiles (id, name, role)
  VALUES (p_user_id, v_username, 'barbershop_member'::public.profile_role)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      role = EXCLUDED.role,
      updated_at = now();

  INSERT INTO public.barbershop_members (
    barbershop_id,
    user_id,
    role,
    username
  )
  VALUES (
    p_barbershop_id,
    p_user_id,
    p_role::public.member_role,
    v_username
  )
  RETURNING * INTO v_member;

  RETURN jsonb_build_object(
    'id', v_member.id,
    'user_id', v_member.user_id,
    'username', v_member.username,
    'role', v_member.role,
    'created_at', v_member.created_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'username_already_exists' USING ERRCODE = '23505';
END;
$_$;


ALTER FUNCTION "public"."register_barbershop_member"("p_owner_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_username" "text", "p_role" "text", "p_max_members" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_barbershop_asset"("p_barbershop_id" "uuid", "p_asset_type" "text", "p_asset_url" "text", "p_storage_path" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_barbershop public.barbershops%ROWTYPE;
  v_previous_url text;
  v_expected_prefix text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT b.*
  INTO v_barbershop
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id
    AND (
      b.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.barbershop_members bm
        WHERE bm.barbershop_id = b.id
          AND bm.user_id = auth.uid()
          AND bm.role::text = 'admin'
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_asset_type NOT IN ('logo', 'banner') THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'asset_type');
  END IF;

  v_expected_prefix := v_barbershop.owner_id::text || '/' || p_asset_type || '/' || p_barbershop_id::text || '-';

  IF p_storage_path IS NULL
     OR p_storage_path NOT LIKE v_expected_prefix || '%'
     OR p_storage_path ~ '[\\]'
     OR p_storage_path LIKE '%..%'
  THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'storage_path');
  END IF;

  IF p_asset_url IS NULL
     OR p_asset_url !~ '^https://'
     OR position('/storage/v1/object/public/barbershop-assets/' || p_storage_path IN p_asset_url) = 0
  THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'asset_url');
  END IF;

  IF p_asset_type = 'logo' THEN
    v_previous_url := v_barbershop.logo_url;
    UPDATE public.barbershops
    SET logo_url = p_asset_url, updated_at = now()
    WHERE id = p_barbershop_id
    RETURNING * INTO v_barbershop;
  ELSE
    v_previous_url := v_barbershop.banner_url;
    UPDATE public.barbershops
    SET banner_url = p_asset_url, updated_at = now()
    WHERE id = p_barbershop_id
    RETURNING * INTO v_barbershop;
  END IF;

  RETURN jsonb_build_object(
    'status', 'updated',
    'asset_type', p_asset_type,
    'asset_url', p_asset_url,
    'previous_url', v_previous_url,
    'updated_at', v_barbershop.updated_at
  );
END;
$$;


ALTER FUNCTION "public"."update_barbershop_asset"("p_barbershop_id" "uuid", "p_asset_type" "text", "p_asset_url" "text", "p_storage_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_barbershop_member_record"("p_owner_id" "uuid", "p_member_id" "uuid", "p_username" "text" DEFAULT NULL::"text", "p_role" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_member public.barbershop_members%ROWTYPE;
  v_username text := CASE
    WHEN p_username IS NULL THEN NULL
    ELSE lower(BTRIM(p_username))
  END;
BEGIN
  IF v_username IS NOT NULL
     AND v_username !~ '^[a-z0-9_]{3,30}$'
  THEN
    RAISE EXCEPTION 'invalid_username' USING ERRCODE = '22023';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'reader') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  SELECT bm.*
  INTO v_member
  FROM public.barbershop_members bm
  JOIN public.barbershops b ON b.id = bm.barbershop_id
  WHERE bm.id = p_member_id
    AND b.owner_id = p_owner_id
  FOR UPDATE OF bm;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_username IS NOT NULL THEN
    UPDATE public.profiles
    SET name = v_username,
        updated_at = now()
    WHERE id = v_member.user_id;
  END IF;

  UPDATE public.barbershop_members
  SET username = COALESCE(v_username, username),
      role = CASE
        WHEN p_role IS NULL THEN role
        ELSE p_role::public.member_role
      END,
      updated_at = now()
  WHERE id = p_member_id
  RETURNING * INTO v_member;

  RETURN jsonb_build_object(
    'id', v_member.id,
    'user_id', v_member.user_id,
    'username', v_member.username,
    'role', v_member.role,
    'updated_at', v_member.updated_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'username_already_exists' USING ERRCODE = '23505';
END;
$_$;


ALTER FUNCTION "public"."update_barbershop_member_record"("p_owner_id" "uuid", "p_member_id" "uuid", "p_username" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_barbershop_settings"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text", "p_slug" "text", "p_description" "text" DEFAULT NULL::"text", "p_owner_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_barbershop public.barbershops%ROWTYPE;
  v_name text := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_slug text := lower(BTRIM(COALESCE(p_slug, '')));
  v_description text := NULLIF(BTRIM(COALESCE(p_description, '')), '');
  v_owner_name text := NULLIF(BTRIM(COALESCE(p_owner_name, '')), '');
  v_is_owner boolean := false;
  v_saved_owner_name text;
  v_constraint text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT b.owner_id = auth.uid()
  INTO v_is_owner
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id
    AND (
      b.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.barbershop_members bm
        WHERE bm.barbershop_id = b.id
          AND bm.user_id = auth.uid()
          AND bm.role::text = 'admin'
      )
    )
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_barbershop
  FROM public.barbershops b
  WHERE b.id = p_barbershop_id;

  v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  v_slug := BTRIM(v_slug, '-');

  IF v_name IS NULL OR char_length(v_name) > 30 THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'name');
  END IF;
  IF length(v_phone) = 11 THEN
    v_phone := '55' || v_phone;
  ELSIF length(v_phone) <> 13 OR NOT v_phone LIKE '55%' THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'phone');
  END IF;
  IF char_length(v_slug) < 3 OR char_length(v_slug) > 80 THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'slug');
  END IF;
  IF v_description IS NOT NULL AND char_length(v_description) > 1000 THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'description');
  END IF;

  SELECT p.name INTO v_saved_owner_name
  FROM public.profiles p
  WHERE p.id = v_barbershop.owner_id;

  IF v_is_owner THEN
    IF v_owner_name IS NULL OR char_length(v_owner_name) > 100 THEN
      RETURN jsonb_build_object('status', 'invalid', 'field', 'owner_name');
    END IF;
  ELSIF v_owner_name IS DISTINCT FROM v_saved_owner_name THEN
    RETURN jsonb_build_object('status', 'not_allowed', 'field', 'owner_name');
  END IF;

  BEGIN
    UPDATE public.barbershops
    SET name = v_name,
        phone = v_phone,
        slug = v_slug,
        description = v_description,
        updated_at = now()
    WHERE id = p_barbershop_id
    RETURNING * INTO v_barbershop;

    IF v_is_owner THEN
      UPDATE public.profiles
      SET name = v_owner_name,
          updated_at = now()
      WHERE id = v_barbershop.owner_id
      RETURNING name INTO v_saved_owner_name;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    RETURN jsonb_build_object(
      'status', 'conflict',
      'field', CASE
        WHEN v_constraint ILIKE '%slug%' THEN 'slug'
        WHEN v_constraint ILIKE '%phone%' THEN 'phone'
        ELSE 'unknown'
      END
    );
  END;

  RETURN jsonb_build_object(
    'status', 'updated',
    'barbershop', jsonb_build_object(
      'id', v_barbershop.id,
      'owner_id', v_barbershop.owner_id,
      'name', v_barbershop.name,
      'slug', v_barbershop.slug,
      'phone', v_barbershop.phone,
      'email', v_barbershop.email,
      'description', v_barbershop.description,
      'logo_url', v_barbershop.logo_url,
      'banner_url', v_barbershop.banner_url,
      'template', v_barbershop.template,
      'is_active', v_barbershop.is_active,
      'onboarding_completed', v_barbershop.onboarding_completed,
      'onboarding_step', v_barbershop.onboarding_step,
      'created_at', v_barbershop.created_at,
      'updated_at', v_barbershop.updated_at,
      'owner_name', v_saved_owner_name
    )
  );
END;
$$;


ALTER FUNCTION "public"."update_barbershop_settings"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text", "p_slug" "text", "p_description" "text", "p_owner_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_name" "text", "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_name text := NULLIF(BTRIM(COALESCE(p_name, '')), ''); -- Sanitiza o nome.
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'); -- Normaliza o telefone.
  v_customer public.customers%ROWTYPE; -- Guarda a linha bloqueada e depois a atualizada.
  v_conflict jsonb;                  -- Guarda outro cliente com o mesmo telefone.
  v_total integer := 0;              -- Quantidade atual de agendamentos não cancelados.
  v_last timestamptz;                -- Data do último agendamento.
BEGIN
  IF auth.uid() IS NULL THEN          -- Exige sessão válida.
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; -- Interrompe usuário anônimo.
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text IN ('admin', 'writer') -- Somente membros com escrita podem atualizar.
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_name IS NULL THEN              -- Recusa nome vazio.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'name');
  END IF;
  IF length(v_phone) NOT IN (10, 11) THEN -- Recusa telefone fora do padrão brasileiro.
    RETURN jsonb_build_object('status', 'invalid', 'field', 'phone');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_barbershop_id::text || ':' || v_phone, 0)
  );                                  -- Impede dois updates/creates simultâneos de reservarem a mesma identidade.

  SELECT * INTO v_customer            -- Carrega a linha real que será alterada.
  FROM public.customers c             -- Consulta diretamente a tabela canônica.
  WHERE c.id = p_customer_id          -- Restringe ao cliente solicitado.
    AND c.barbershop_id = p_barbershop_id -- Garante que pertence à barbearia autorizada.
    AND NOT COALESCE(c.auth, false)    -- Impede editar autenticados por este fluxo.
  FOR UPDATE;                         -- Bloqueia a linha contra alterações concorrentes.

  IF NOT FOUND THEN                   -- Também cobre ID de outra barbearia sem revelar sua existência.
    RETURN jsonb_build_object('status', 'not_found'); -- Resposta segura e previsível.
  END IF;

  SELECT jsonb_build_object(
    'id', c.id, 'barbershop_id', c.barbershop_id, 'name', c.name,
    'phone', c.phone, 'created_at', c.created_at, 'updated_at', c.updated_at,
    'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers',
    'total_appointments', 0, 'last_appointment', NULL
  )
  INTO v_conflict
  FROM public.customers c
  WHERE c.barbershop_id = p_barbershop_id
    AND c.id <> p_customer_id
    AND NOT COALESCE(c.auth, false)
    AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_conflict IS NULL THEN          -- Só procura autenticado se não achou manual conflitante.
    SELECT jsonb_build_object(
      'id', c.id, 'barbershop_id', p_barbershop_id,
      'name', COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome'),
      'phone', c.phone, 'created_at', MIN(COALESCE(a.created_at, c.created_at)),
      'updated_at', c.updated_at, 'auth', c.auth, 'auth_user_id', c.auth_user_id,
      'source', 'customers_auth', 'total_appointments', COUNT(a.id)::integer,
      'last_appointment', MAX(a.starts_at)
    )
    INTO v_conflict
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND c.id <> p_customer_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    GROUP BY c.id
    ORDER BY MIN(COALESCE(a.created_at, c.created_at)) DESC
    LIMIT 1;
  END IF;

  IF v_conflict IS NOT NULL THEN      -- Telefone já identifica outra pessoa.
    RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict); -- Não executa update inconsistente.
  END IF;

  BEGIN                               -- Protege contra conflito criado entre a consulta e o update.
    UPDATE public.customers           -- Atualiza a tabela canônica.
    SET name = v_name,                -- Persiste o nome sanitizado.
        phone = v_phone,              -- Persiste somente os dígitos.
        updated_at = now()            -- Deixa a data sob responsabilidade do banco.
    WHERE id = p_customer_id          -- Altera somente a linha previamente bloqueada.
    RETURNING * INTO v_customer;      -- Recupera a versão oficial atualizada.
  EXCEPTION WHEN unique_violation THEN -- Captura corrida de telefone duplicado.
    RETURN jsonb_build_object('status', 'conflict'); -- Informa conflito sem expor detalhes internos.
  END;

  SELECT
    COUNT(a.id) FILTER (
      WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
    )::integer,
    MAX(a.starts_at) FILTER (
      WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
    )
  INTO v_total, v_last
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id
    AND a.manual_customer_id = p_customer_id;

  RETURN jsonb_build_object(          -- Entrega a versão final e suas estatísticas à UI.
    'status', 'updated',              -- Confirma que o update foi concluído.
    'customer', jsonb_build_object(
      'id', v_customer.id, 'barbershop_id', v_customer.barbershop_id,
      'name', v_customer.name, 'phone', v_customer.phone,
      'created_at', v_customer.created_at, 'updated_at', v_customer.updated_at,
      'auth', v_customer.auth, 'auth_user_id', v_customer.auth_user_id,
      'source', 'customers', 'total_appointments', v_total, 'last_appointment', v_last
    )
  );
END;                                  -- Finaliza update_customer.
$$;


ALTER FUNCTION "public"."update_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_name" "text", "p_phone" "text") OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "manual_customer_id" "uuid",
    "barber_id" "uuid",
    "service_id" "uuid",
    "notes" "text",
    "status" "public"."appointment_status" DEFAULT 'scheduled'::"public"."appointment_status" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "service_name" "text",
    "service_price" numeric,
    "customer_name" "text",
    "service_duration" integer,
    "barber_name" "text",
    "booking_request_id" "uuid",
    CONSTRAINT "appointments_one_customer_only" CHECK (((("customer_id" IS NOT NULL) AND ("manual_customer_id" IS NULL)) OR (("customer_id" IS NULL) AND ("manual_customer_id" IS NOT NULL)) OR (("customer_id" IS NULL) AND ("manual_customer_id" IS NULL)))),
    CONSTRAINT "appointments_valid_period" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "appointments_valid_time_range" CHECK (("starts_at" < "ends_at"))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."barber_services" (
    "barber_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."barber_services" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."barbershop_gallery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "barbershop_gallery_order_nonnegative" CHECK (("order" >= 0)),
    CONSTRAINT "barbershop_gallery_url_not_empty" CHECK ((("length"(TRIM(BOTH FROM "url")) > 0) AND ("length"("url") <= 2048)))
);


ALTER TABLE "public"."barbershop_gallery" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth" boolean DEFAULT false NOT NULL,
    "auth_user_id" "uuid"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_no_active_barber_overlap" EXCLUDE USING "gist" ("barber_id" WITH =, "tstzrange"("starts_at", "ends_at", '[)'::"text") WITH &&) WHERE (("status" <> ALL (ARRAY['cancelled_by_customer'::"public"."appointment_status", 'cancelled_by_barbershop'::"public"."appointment_status", 'no_show'::"public"."appointment_status"])));



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_no_overlap_per_barber" EXCLUDE USING "gist" ("barber_id" WITH =, "tstzrange"("starts_at", "ends_at", '[)'::"text") WITH &&) WHERE ((("barber_id" IS NOT NULL) AND ("status" <> ALL (ARRAY['cancelled_by_customer'::"public"."appointment_status", 'cancelled_by_barbershop'::"public"."appointment_status", 'no_show'::"public"."appointment_status"]))));



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asaas_rate_limits"
    ADD CONSTRAINT "asaas_rate_limits_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_barber_day_order_unique" UNIQUE ("barber_id", "day_of_week", "period_order");



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barber_services"
    ADD CONSTRAINT "barber_services_pkey" PRIMARY KEY ("barber_id", "service_id");



ALTER TABLE ONLY "public"."barbers"
    ADD CONSTRAINT "barbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbershop_gallery"
    ADD CONSTRAINT "barbershop_gallery_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_barbershop_phone_unique" UNIQUE ("barbershop_id", "phone");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "idx_appointments_barber" ON "public"."appointments" USING "btree" ("barber_id");



CREATE INDEX "idx_appointments_barber_period" ON "public"."appointments" USING "btree" ("barber_id", "starts_at", "ends_at");



CREATE INDEX "idx_appointments_barber_range" ON "public"."appointments" USING "btree" ("barbershop_id", "barber_id", "starts_at", "ends_at") WHERE ("status" = 'scheduled'::"public"."appointment_status");



CREATE INDEX "idx_appointments_barbershop" ON "public"."appointments" USING "btree" ("barbershop_id");



CREATE INDEX "idx_appointments_booking_request" ON "public"."appointments" USING "btree" ("barbershop_id", "booking_request_id") WHERE ("booking_request_id" IS NOT NULL);



CREATE INDEX "idx_appointments_customer" ON "public"."appointments" USING "btree" ("customer_id");



CREATE INDEX "idx_appointments_manual_customer" ON "public"."appointments" USING "btree" ("manual_customer_id");



CREATE INDEX "idx_appointments_no_show_check" ON "public"."appointments" USING "btree" ("starts_at") WHERE ("status" = 'scheduled'::"public"."appointment_status");



CREATE INDEX "idx_appointments_reports_shop_barber_starts" ON "public"."appointments" USING "btree" ("barbershop_id", "barber_id", "starts_at");



CREATE INDEX "idx_appointments_reports_shop_customer" ON "public"."appointments" USING "btree" ("barbershop_id", "customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_appointments_reports_shop_starts" ON "public"."appointments" USING "btree" ("barbershop_id", "starts_at");



CREATE INDEX "idx_appointments_scheduled_starts_at" ON "public"."appointments" USING "btree" ("starts_at") WHERE ("status" = 'scheduled'::"public"."appointment_status");



CREATE INDEX "idx_appointments_service" ON "public"."appointments" USING "btree" ("service_id");



CREATE INDEX "idx_appointments_shop_auth_customer_starts" ON "public"."appointments" USING "btree" ("barbershop_id", "customer_id", "starts_at" DESC) WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_appointments_shop_manual_customer_starts" ON "public"."appointments" USING "btree" ("barbershop_id", "manual_customer_id", "starts_at" DESC) WHERE ("manual_customer_id" IS NOT NULL);



CREATE INDEX "idx_appointments_shop_start" ON "public"."appointments" USING "btree" ("barbershop_id", "starts_at");



CREATE INDEX "idx_appointments_starts_at" ON "public"."appointments" USING "btree" ("starts_at");



CREATE INDEX "idx_barber_availability_shop_barber_day" ON "public"."barber_availability" USING "btree" ("barbershop_id", "barber_id", "day_of_week");



CREATE INDEX "idx_barber_services_barber" ON "public"."barber_services" USING "btree" ("barber_id");



CREATE INDEX "idx_barber_services_service" ON "public"."barber_services" USING "btree" ("service_id");



CREATE INDEX "idx_barbers_barbershop" ON "public"."barbers" USING "btree" ("barbershop_id");



CREATE INDEX "idx_barbershop_gallery_shop_order" ON "public"."barbershop_gallery" USING "btree" ("barbershop_id", "order", "created_at");



CREATE INDEX "idx_barbershops_is_active" ON "public"."barbershops" USING "btree" ("is_active");



CREATE INDEX "idx_barbershops_slug" ON "public"."barbershops" USING "btree" ("slug");



CREATE INDEX "idx_customers_auth" ON "public"."customers" USING "btree" ("auth") WHERE ("auth" = true);



CREATE INDEX "idx_customers_barbershop" ON "public"."customers" USING "btree" ("barbershop_id");



CREATE INDEX "idx_customers_barbershop_created_at" ON "public"."customers" USING "btree" ("barbershop_id", "created_at" DESC);



CREATE INDEX "idx_customers_barbershop_phone" ON "public"."customers" USING "btree" ("barbershop_id", "phone");



CREATE INDEX "idx_customers_barbershop_phone_normalized" ON "public"."customers" USING "btree" ("barbershop_id", "regexp_replace"(COALESCE("phone", ''::"text"), '[^0-9]'::"text", ''::"text", 'g'::"text"));



CREATE INDEX "idx_customers_reports_auth_id" ON "public"."customers" USING "btree" ("id") WHERE ("auth" = true);



CREATE INDEX "idx_customers_reports_shop_created" ON "public"."customers" USING "btree" ("barbershop_id", "created_at");



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



CREATE UNIQUE INDEX "uq_customers_manual_barbershop_phone_normalized" ON "public"."customers" USING "btree" ("barbershop_id", "regexp_replace"(COALESCE("phone", ''::"text"), '[^0-9]'::"text", ''::"text", 'g'::"text")) WHERE (("barbershop_id" IS NOT NULL) AND (NOT COALESCE("auth", false)) AND (NULLIF("regexp_replace"(COALESCE("phone", ''::"text"), '[^0-9]'::"text", ''::"text", 'g'::"text"), ''::"text") IS NOT NULL));



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."barbershop_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_addresses_updated_at" BEFORE UPDATE ON "public"."addresses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



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



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barber_availability"
    ADD CONSTRAINT "barber_availability_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barber_services"
    ADD CONSTRAINT "barber_services_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barber_services"
    ADD CONSTRAINT "barber_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbers"
    ADD CONSTRAINT "barbers_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_gallery"
    ADD CONSTRAINT "barbershop_gallery_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_members"
    ADD CONSTRAINT "barbershop_members_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_members"
    ADD CONSTRAINT "barbershop_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



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


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_insert_staff" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "appointments"."barbershop_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."barbershop_members" "bm"
  WHERE (("bm"."barbershop_id" = "appointments"."barbershop_id") AND ("bm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "appointments_select_staff" ON "public"."appointments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'master'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "appointments"."barbershop_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."barbershop_members" "bm"
  WHERE (("bm"."barbershop_id" = "appointments"."barbershop_id") AND ("bm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "appointments_update_staff" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'master'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "appointments"."barbershop_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."barbershop_members" "bm"
  WHERE (("bm"."barbershop_id" = "appointments"."barbershop_id") AND ("bm"."user_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'master'::"public"."profile_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "appointments"."barbershop_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."barbershop_members" "bm"
  WHERE (("bm"."barbershop_id" = "appointments"."barbershop_id") AND ("bm"."user_id" = "auth"."uid"()))))));



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



ALTER TABLE "public"."barber_services" ENABLE ROW LEVEL SECURITY;


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



ALTER TABLE "public"."barbershop_gallery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barbershop_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barbershops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "barbershops_delete_owner" ON "public"."barbershops" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "barbershops_select_member" ON "public"."barbershops" FOR SELECT TO "authenticated" USING ("public"."is_barbershop_member"("id"));



CREATE POLICY "barbershops_select_owner" ON "public"."barbershops" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "barbershops_update_owner" ON "public"."barbershops" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gallery_delete_manager" ON "public"."barbershop_gallery" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "barbershop_gallery"."barbershop_id") AND (("b"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_barbershop_admin"("barbershop_gallery"."barbershop_id"))))));



CREATE POLICY "gallery_insert_manager" ON "public"."barbershop_gallery" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "barbershop_gallery"."barbershop_id") AND (("b"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_barbershop_admin"("barbershop_gallery"."barbershop_id"))))));



CREATE POLICY "gallery_select_public" ON "public"."barbershop_gallery" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "gallery_update_manager" ON "public"."barbershop_gallery" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "barbershop_gallery"."barbershop_id") AND (("b"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_barbershop_admin"("barbershop_gallery"."barbershop_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "barbershop_gallery"."barbershop_id") AND (("b"."owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_barbershop_admin"("barbershop_gallery"."barbershop_id"))))));



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



CREATE POLICY "owner_admin_can_manage_barber_services" ON "public"."barber_services" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."barbers" "b"
     JOIN "public"."services" "s" ON ((("s"."id" = "barber_services"."service_id") AND ("s"."barbershop_id" = "b"."barbershop_id"))))
     JOIN "public"."barbershops" "bs" ON (("bs"."id" = "b"."barbershop_id")))
  WHERE (("b"."id" = "barber_services"."barber_id") AND (("bs"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("b"."barbershop_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."barbers" "b"
     JOIN "public"."services" "s" ON ((("s"."id" = "barber_services"."service_id") AND ("s"."barbershop_id" = "b"."barbershop_id"))))
     JOIN "public"."barbershops" "bs" ON (("bs"."id" = "b"."barbershop_id")))
  WHERE (("b"."id" = "barber_services"."barber_id") AND (("bs"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("b"."barbershop_id"))))));



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



CREATE POLICY "public_can_view_active_barber_services" ON "public"."barber_services" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM (("public"."barbers" "b"
     JOIN "public"."services" "s" ON ((("s"."id" = "barber_services"."service_id") AND ("s"."barbershop_id" = "b"."barbershop_id"))))
     JOIN "public"."barbershops" "bs" ON (("bs"."id" = "b"."barbershop_id")))
  WHERE (("b"."id" = "barber_services"."barber_id") AND ("bs"."is_active" = true) AND ("b"."is_active" = true) AND ("s"."is_active" = true)))));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_delete_owner_admin" ON "public"."services" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "services"."barbershop_id") AND (("b"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("b"."id"))))));



CREATE POLICY "services_insert_owner_admin" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "services"."barbershop_id") AND (("b"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("b"."id"))))));



CREATE POLICY "services_select_active_public" ON "public"."services" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "services_select_owner_admin" ON "public"."services" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "services"."barbershop_id") AND (("b"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("b"."id"))))));



CREATE POLICY "services_update_owner_admin" ON "public"."services" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "services"."barbershop_id") AND (("b"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("b"."id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "services"."barbershop_id") AND (("b"."owner_id" = "auth"."uid"()) OR "public"."is_barbershop_admin"("b"."id"))))));



ALTER TABLE "public"."store_style" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_style_insert_owner" ON "public"."store_style" FOR INSERT TO "authenticated" WITH CHECK (("barbershop_id" IN ( SELECT "barbershops"."id"
   FROM "public"."barbershops"
  WHERE ("barbershops"."owner_id" = "auth"."uid"()))));



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




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";












GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."asaas_rate_limit_hit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_appointment_read_access"("p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_appointment_read_access"("p_barbershop_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_appointment_write_access"("p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_appointment_write_access"("p_barbershop_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_gallery"("p_barbershop_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_gallery"("p_barbershop_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_manage_gallery"("p_barbershop_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."change_manager_appointment_status"("p_appointment_id" "uuid", "p_expected_status" "text", "p_new_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_manager_appointment_status"("p_appointment_id" "uuid", "p_expected_status" "text", "p_new_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."change_manager_appointment_status"("p_appointment_id" "uuid", "p_expected_status" "text", "p_new_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."check_opening_hours_overlap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_phone_exists"("p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_confirmation_status"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_confirmation_status"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_confirmation_status"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_subscription_provisioning"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_unverified_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_unverified_users"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_customer"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_customer"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_customer"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_manager_appointments"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_customer_source" "text", "p_local_date" "date", "p_items" "jsonb", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_manager_appointments"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_customer_source" "text", "p_local_date" "date", "p_items" "jsonb", "p_idempotency_key" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_manager_appointments"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_customer_source" "text", "p_local_date" "date", "p_items" "jsonb", "p_idempotency_key" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decrement_coupon_usage"("p_coupon_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_member"("p_member_id" "uuid", "p_barbershop_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_appointment_booking_context"("p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_appointment_booking_context"("p_barbershop_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_appointment_booking_context"("p_barbershop_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_available_appointment_slots"("p_barbershop_id" "uuid", "p_service_id" "uuid", "p_barber_id" "uuid", "p_local_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_available_appointment_slots"("p_barbershop_id" "uuid", "p_service_id" "uuid", "p_barber_id" "uuid", "p_local_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_available_appointment_slots"("p_barbershop_id" "uuid", "p_service_id" "uuid", "p_barber_id" "uuid", "p_local_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_barbershop_members"("p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_barbershop_members"("p_barbershop_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_barbershop_members"("p_barbershop_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_customer_history"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_source" "text", "p_page" integer, "p_page_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_customer_history"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_source" "text", "p_page" integer, "p_page_size" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_customer_history"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_source" "text", "p_page" integer, "p_page_size" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_customers"("p_barbershop_id" "uuid", "p_search" "text", "p_page" integer, "p_page_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_customers"("p_barbershop_id" "uuid", "p_search" "text", "p_page" integer, "p_page_size" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_customers"("p_barbershop_id" "uuid", "p_search" "text", "p_page" integer, "p_page_size" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_dashboard_summary"("p_barbershop_id" "uuid", "p_for_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_barbershop_id" "uuid", "p_for_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_barbershop_id" "uuid", "p_for_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_manager_appointments"("p_barbershop_id" "uuid", "p_from_date" "date", "p_to_date_exclusive" "date", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_manager_appointments"("p_barbershop_id" "uuid", "p_from_date" "date", "p_to_date_exclusive" "date", "p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_manager_appointments"("p_barbershop_id" "uuid", "p_from_date" "date", "p_to_date_exclusive" "date", "p_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_member_auth_email"("p_username" "text", "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_member_barbershop_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_member_barbershop_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_reports_summary"("p_barbershop_id" "uuid", "p_from" "date", "p_to" "date", "p_barber_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_reports_summary"("p_barbershop_id" "uuid", "p_from" "date", "p_to" "date", "p_barber_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_reports_summary"("p_barbershop_id" "uuid", "p_from" "date", "p_to" "date", "p_barber_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_settings_alerts"("p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_settings_alerts"("p_barbershop_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_settings_alerts"("p_barbershop_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."handle_new_barbershop_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_access"("p_barbershop_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_coupon_usage"("p_coupon_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_coupon_usage"("p_coupon_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_barbershop_active"("p_barbershop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_barbershop_admin"("p_barbershop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_barbershop_admin"("p_barbershop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_barbershop_member"("p_barbershop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_barbershop_member"("p_barbershop_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_overdue_appointments_as_no_show"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_overdue_appointments_as_no_show"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_barbershop_member"("p_owner_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_username" "text", "p_role" "text", "p_max_members" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_barbershop_member"("p_owner_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_username" "text", "p_role" "text", "p_max_members" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barbershop_timezone"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_barbershop_asset"("p_barbershop_id" "uuid", "p_asset_type" "text", "p_asset_url" "text", "p_storage_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_barbershop_asset"("p_barbershop_id" "uuid", "p_asset_type" "text", "p_asset_url" "text", "p_storage_path" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_barbershop_asset"("p_barbershop_id" "uuid", "p_asset_type" "text", "p_asset_url" "text", "p_storage_path" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_barbershop_member_record"("p_owner_id" "uuid", "p_member_id" "uuid", "p_username" "text", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_barbershop_member_record"("p_owner_id" "uuid", "p_member_id" "uuid", "p_username" "text", "p_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_barbershop_settings"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text", "p_slug" "text", "p_description" "text", "p_owner_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_barbershop_settings"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text", "p_slug" "text", "p_description" "text", "p_owner_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_barbershop_settings"("p_barbershop_id" "uuid", "p_name" "text", "p_phone" "text", "p_slug" "text", "p_description" "text", "p_owner_name" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_name" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_name" "text", "p_phone" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_customer"("p_barbershop_id" "uuid", "p_customer_id" "uuid", "p_name" "text", "p_phone" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."validate_coupon"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_coupon"("p_code" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."validate_coupon"("p_code" "text") TO "authenticated";
























GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."addresses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."appointments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."asaas_rate_limits" TO "anon";
GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."asaas_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."asaas_rate_limits" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."barber_availability" TO "anon";
GRANT ALL ON TABLE "public"."barber_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."barber_availability" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."barber_services" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."barber_services" TO "authenticated";
GRANT ALL ON TABLE "public"."barber_services" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."barbers" TO "anon";
GRANT ALL ON TABLE "public"."barbers" TO "authenticated";
GRANT ALL ON TABLE "public"."barbers" TO "service_role";



GRANT ALL ON TABLE "public"."barbershop_gallery" TO "service_role";
GRANT SELECT ON TABLE "public"."barbershop_gallery" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."barbershop_gallery" TO "authenticated";



GRANT REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."barbershop_members" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."barbershop_members" TO "authenticated";
GRANT ALL ON TABLE "public"."barbershop_members" TO "service_role";



GRANT MAINTAIN ON TABLE "public"."barbershops" TO "anon";
GRANT SELECT,MAINTAIN,UPDATE ON TABLE "public"."barbershops" TO "authenticated";
GRANT ALL ON TABLE "public"."barbershops" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coupons" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customers" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



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



GRANT ALL ON TABLE "public"."services" TO "service_role";
GRANT SELECT ON TABLE "public"."services" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."services" TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."store_style" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,MAINTAIN,UPDATE ON TABLE "public"."store_style" TO "authenticated";
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



































drop policy "barber_availability_select_public" on "public"."barber_availability";

drop policy "public_can_view_active_barber_services" on "public"."barber_services";

drop policy "gallery_select_public" on "public"."barbershop_gallery";

drop policy "plans_select_active_or_own" on "public"."plans";

drop policy "services_select_active_public" on "public"."services";

drop policy "store_style_select_public" on "public"."store_style";

revoke truncate on table "public"."asaas_rate_limits" from "anon";

revoke truncate on table "public"."asaas_rate_limits" from "authenticated";

revoke references on table "public"."barbershop_gallery" from "anon";

revoke trigger on table "public"."barbershop_gallery" from "anon";

revoke truncate on table "public"."barbershop_gallery" from "anon";

revoke references on table "public"."barbershop_gallery" from "authenticated";

revoke trigger on table "public"."barbershop_gallery" from "authenticated";

revoke truncate on table "public"."barbershop_gallery" from "authenticated";

revoke truncate on table "public"."barbershop_members" from "anon";

revoke truncate on table "public"."barbershop_members" from "authenticated";

revoke references on table "public"."barbershops" from "anon";

revoke trigger on table "public"."barbershops" from "anon";

revoke truncate on table "public"."barbershops" from "anon";

revoke references on table "public"."barbershops" from "authenticated";

revoke trigger on table "public"."barbershops" from "authenticated";

revoke truncate on table "public"."barbershops" from "authenticated";

revoke references on table "public"."ops_alerts" from "anon";

revoke trigger on table "public"."ops_alerts" from "anon";

revoke truncate on table "public"."ops_alerts" from "anon";

revoke references on table "public"."ops_alerts" from "authenticated";

revoke trigger on table "public"."ops_alerts" from "authenticated";

revoke truncate on table "public"."ops_alerts" from "authenticated";

revoke truncate on table "public"."payments" from "anon";

revoke truncate on table "public"."payments" from "authenticated";

revoke references on table "public"."plans" from "anon";

revoke trigger on table "public"."plans" from "anon";

revoke truncate on table "public"."plans" from "anon";

revoke references on table "public"."plans" from "authenticated";

revoke trigger on table "public"."plans" from "authenticated";

revoke truncate on table "public"."plans" from "authenticated";

revoke truncate on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "authenticated";

revoke references on table "public"."services" from "anon";

revoke trigger on table "public"."services" from "anon";

revoke truncate on table "public"."services" from "anon";

revoke references on table "public"."services" from "authenticated";

revoke trigger on table "public"."services" from "authenticated";

revoke truncate on table "public"."services" from "authenticated";

revoke truncate on table "public"."store_style" from "anon";

revoke truncate on table "public"."store_style" from "authenticated";

revoke references on table "public"."subscriptions" from "anon";

revoke trigger on table "public"."subscriptions" from "anon";

revoke truncate on table "public"."subscriptions" from "anon";

revoke references on table "public"."subscriptions" from "authenticated";

revoke trigger on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."webhook_events" from "anon";

revoke truncate on table "public"."webhook_events" from "authenticated";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.sync_barbershop_timezone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$-- Sincroniza o timezone da barbearia sempre que o estado do endereço for inserido ou alterado.
-- Estados com fuso próprio são mapeados explicitamente; todos os outros caem em America/Sao_Paulo.
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

end;$function$
;


  create policy "barber_availability_select_public"
  on "public"."barber_availability"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "public_can_view_active_barber_services"
  on "public"."barber_services"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM ((public.barbers b
     JOIN public.services s ON (((s.id = barber_services.service_id) AND (s.barbershop_id = b.barbershop_id))))
     JOIN public.barbershops bs ON ((bs.id = b.barbershop_id)))
  WHERE ((b.id = barber_services.barber_id) AND (bs.is_active = true) AND (b.is_active = true) AND (s.is_active = true)))));



  create policy "gallery_select_public"
  on "public"."barbershop_gallery"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "plans_select_active_or_own"
  on "public"."plans"
  as permissive
  for select
  to anon, authenticated
using (((is_active = true) OR (EXISTS ( SELECT 1
   FROM (public.subscriptions s
     JOIN public.barbershops b ON ((b.id = s.barbershop_id)))
  WHERE ((s.plan_id = plans.id) AND (b.owner_id = auth.uid()))))));



  create policy "services_select_active_public"
  on "public"."services"
  as permissive
  for select
  to anon, authenticated
using ((is_active = true));



  create policy "store_style_select_public"
  on "public"."store_style"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER trg_handle_new_barbershop_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_barbershop_user();


  create policy "Public can read assets"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'barbershop-assets'::text));



  create policy "admin or owner can delete from barbershop-assets"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'barbershop-assets'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM (public.barbershop_members bm
     JOIN public.barbershops b ON ((b.id = bm.barbershop_id)))
  WHERE ((bm.user_id = auth.uid()) AND ((bm.role)::text = 'admin'::text) AND ((b.owner_id)::text = (storage.foldername(b.name))[1])))))));



  create policy "admin or owner can update barbershop-assets"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'barbershop-assets'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM (public.barbershop_members bm
     JOIN public.barbershops b ON ((b.id = bm.barbershop_id)))
  WHERE ((bm.user_id = auth.uid()) AND ((bm.role)::text = 'admin'::text) AND ((b.owner_id)::text = (storage.foldername(b.name))[1])))))))
with check (((bucket_id = 'barbershop-assets'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM (public.barbershop_members bm
     JOIN public.barbershops b ON ((b.id = bm.barbershop_id)))
  WHERE ((bm.user_id = auth.uid()) AND ((bm.role)::text = 'admin'::text) AND ((b.owner_id)::text = (storage.foldername(b.name))[1]))))) AND (lower(storage.extension(name)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text])) AND ((metadata ->> 'mimetype'::text) = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])) AND ((metadata ->> 'size'::text) ~ '^[0-9]+$'::text) AND ((((metadata ->> 'size'::text))::bigint >= 1) AND (((metadata ->> 'size'::text))::bigint <= 5242880))));



  create policy "admin or owner can upload to barbershop-assets"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'barbershop-assets'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM (public.barbershop_members bm
     JOIN public.barbershops b ON ((b.id = bm.barbershop_id)))
  WHERE ((bm.user_id = auth.uid()) AND ((bm.role)::text = 'admin'::text) AND ((b.owner_id)::text = (storage.foldername(b.name))[1]))))) AND (lower(storage.extension(name)) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text])) AND ((metadata ->> 'mimetype'::text) = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])) AND ((metadata ->> 'size'::text) ~ '^[0-9]+$'::text) AND ((((metadata ->> 'size'::text))::bigint >= 1) AND (((metadata ->> 'size'::text))::bigint <= 5242880))));



  create policy "block anon writes on barbershop-assets"
  on "storage"."objects"
  as permissive
  for insert
  to anon
with check (false);



  create policy "gallery_storage_delete_manager"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'gallery'::text) AND public.can_manage_gallery((storage.foldername(name))[1])));



  create policy "gallery_storage_insert_manager"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'gallery'::text) AND public.can_manage_gallery((storage.foldername(name))[1])));



  create policy "gallery_storage_select_manager"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'gallery'::text) AND public.can_manage_gallery((storage.foldername(name))[1])));


