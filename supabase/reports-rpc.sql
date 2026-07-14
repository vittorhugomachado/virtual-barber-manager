-- Reports summary RPC
-- Aggregates report data in Postgres instead of loading full appointment/customer
-- lists in the browser.

CREATE OR REPLACE FUNCTION public.get_reports_summary(
  p_barbershop_id uuid,
  p_from date,
  p_to date,
  p_barber_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.get_reports_summary(uuid, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reports_summary(uuid, date, date, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_reports_summary(uuid, date, date, uuid)
IS 'Returns authorized, aggregated reports data for one barbershop and period.';

CREATE INDEX IF NOT EXISTS idx_appointments_reports_shop_starts
  ON public.appointments (barbershop_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_reports_shop_barber_starts
  ON public.appointments (barbershop_id, barber_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_reports_shop_customer
  ON public.appointments (barbershop_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_reports_shop_created
  ON public.customers (barbershop_id, created_at);

CREATE INDEX IF NOT EXISTS idx_customers_reports_auth_id
  ON public.customers (id)
  WHERE auth = true;
