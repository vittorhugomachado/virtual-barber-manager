-- Dashboard summary RPC
-- Keeps dashboard authorization and aggregation in the database.

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_barbershop_id uuid,
  p_for_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, date) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_summary(uuid, date)
IS 'Returns authorized, aggregated dashboard data for one barbershop.';
