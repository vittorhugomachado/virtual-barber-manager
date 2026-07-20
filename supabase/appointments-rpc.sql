-- =============================================================================
-- RPCs seguras da agenda do painel administrativo
-- =============================================================================
-- Execute este arquivo manualmente no SQL Editor do Supabase.
--
-- Objetivos:
--   1. manter autorização e regras de negócio no PostgreSQL;
--   2. usar a timezone IANA da barbearia para converter data/hora local;
--   3. calcular disponibilidade sem expor dados de outros clientes;
--   4. criar vários serviços em uma única transação e com idempotência;
--   5. impedir sobreposição de horários mesmo com dois dispositivos concorrendo;
--   6. impedir INSERT/UPDATE/DELETE direto após os clientes migrarem para as RPCs.
--
-- Premissas já utilizadas pelo frontend atual:
--   public.appointments possui: id, barbershop_id, customer_id,
--   manual_customer_id, barber_id, service_id, starts_at, ends_at, status,
--   notes, created_at, customer_name, barber_name, service_name,
--   service_price e service_duration.
--
-- Nota sobre o contrato da API:
--   a coluna persistida se chama service_duration, mas as RPCs devolvem o campo
--   service_duration_min para manter o mesmo formato usado pelo frontend.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A timezone já existe no schema remoto, mas este ALTER torna o script seguro
-- também em ambientes mais antigos. Use sempre um nome IANA de pg_timezone_names.
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';

-- Identifica uma tentativa de criação. Todas as linhas do mesmo agendamento
-- composto recebem a mesma chave e uma repetição de rede devolve o resultado já criado.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booking_request_id uuid;

CREATE INDEX IF NOT EXISTS idx_appointments_shop_start
  ON public.appointments (barbershop_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_barber_period
  ON public.appointments (barber_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_appointments_booking_request
  ON public.appointments (barbershop_id, booking_request_id)
  WHERE booking_request_id IS NOT NULL;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_valid_period'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_valid_period CHECK (ends_at > starts_at);
  END IF;
END;
$block$;

-- Esta exclusão é a última barreira contra corrida: dois requests podem enxergar
-- o mesmo slot livre, mas somente um deles conseguirá inserir o intervalo.
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_no_active_barber_overlap'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_active_barber_overlap
      EXCLUDE USING gist (
        barber_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (
        status NOT IN (
          'cancelled_by_customer'::public.appointment_status,
          'cancelled_by_barbershop'::public.appointment_status,
          'no_show'::public.appointment_status
        )
      );
  END IF;
END;
$block$;

-- Função interna: confirma que a sessão pode visualizar a agenda da barbearia.
-- Retorna void e lança 42501 para não revelar se uma barbearia alheia existe.
CREATE OR REPLACE FUNCTION public.assert_appointment_read_access(p_barbershop_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Função interna: escrita é permitida somente ao proprietário ou administrador.
CREATE OR REPLACE FUNCTION public.assert_appointment_write_access(p_barbershop_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.barbershops b
    WHERE b.id = p_barbershop_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.barbershop_members bm
          WHERE bm.barbershop_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role::text = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
END;
$function$;

-- Retorna o contexto estável usado pelo modal em uma única chamada:
-- timezone, serviços ativos, barbeiros ativos, vínculos e expediente.
CREATE OR REPLACE FUNCTION public.get_appointment_booking_context(p_barbershop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Calcula os slots de um único serviço/barbeiro/data no banco.
-- O retorno contém somente horário e disponibilidade; nunca expõe cliente,
-- telefone ou detalhes do agendamento que ocupou o intervalo.
CREATE OR REPLACE FUNCTION public.get_available_appointment_slots(
  p_barbershop_id uuid,
  p_service_id uuid,
  p_barber_id uuid,
  p_local_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Lista a agenda administrativa em uma única consulta. As datas recebidas são
-- datas locais da barbearia e são convertidas para timestamptz dentro do banco.
CREATE OR REPLACE FUNCTION public.get_manager_appointments(
  p_barbershop_id uuid,
  p_from_date date,
  p_to_date_exclusive date,
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Cria um ou mais serviços de agendamento atomicamente. O frontend envia apenas
-- IDs e horário local; duração, preço, nomes, término e disponibilidade vêm do banco.
CREATE OR REPLACE FUNCTION public.create_manager_appointments(
  p_barbershop_id uuid,
  p_customer_id uuid,
  p_customer_source text,
  p_local_date date,
  p_items jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Altera o status com lock, autorização e transição explícita. O status esperado
-- impede que uma tela antiga sobrescreva uma mudança realizada em outro dispositivo.
CREATE OR REPLACE FUNCTION public.change_manager_appointment_status(
  p_appointment_id uuid,
  p_expected_status text,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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

  IF v_appointment.status::text <> 'scheduled'
     OR p_new_status NOT IN ('completed', 'no_show', 'cancelled_by_barbershop') THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = '22023';
  END IF;

  IF p_new_status IN ('completed', 'no_show') AND v_appointment.starts_at > now() THEN
    RAISE EXCEPTION 'appointment_not_started' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = p_new_status::public.appointment_status
  WHERE id = p_appointment_id
  RETURNING * INTO v_appointment;

  RETURN jsonb_build_object('appointment', to_jsonb(v_appointment));
END;
$function$;

-- As funções internas não devem ser chamadas diretamente por clientes.
REVOKE ALL ON FUNCTION public.assert_appointment_read_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_appointment_write_access(uuid) FROM PUBLIC, anon, authenticated;

-- Somente usuários autenticados chamam as RPCs; cada função ainda valida o vínculo.
REVOKE ALL ON FUNCTION public.get_appointment_booking_context(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_available_appointment_slots(uuid, uuid, uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_manager_appointments(uuid, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_manager_appointments(uuid, uuid, text, date, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_manager_appointment_status(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_appointment_booking_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_appointment_slots(uuid, uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_appointments(uuid, date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_manager_appointments(uuid, uuid, text, date, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_manager_appointment_status(uuid, text, text) TO authenticated;

-- Depois deste ponto, navegadores não podem mais contornar as regras com CRUD direto.
-- Se outro projeto ainda grava diretamente em appointments, migre-o para uma RPC antes
-- de executar estas três linhas.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.appointments FROM anon, authenticated;

COMMIT;
