-- Customer management RPCs
--
-- This file is intentionally not executed by the frontend. Run it manually in
-- the Supabase SQL editor after reviewing it for the target project.

CREATE OR REPLACE FUNCTION public.get_customers(
  p_barbershop_id uuid,
  p_search text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_search text := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  v_search_phone text;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
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
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  v_search_phone := NULLIF(regexp_replace(COALESCE(v_search, ''), '[^0-9]', '', 'g'), '');

  WITH manual_customers AS (
    SELECT
      c.id,
      c.barbershop_id,
      c.name,
      c.phone,
      c.created_at,
      c.updated_at,
      c.auth,
      c.auth_user_id,
      'customers'::text AS source,
      COUNT(a.id) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS total_appointments,
      MAX(a.starts_at) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      ) AS last_appointment
    FROM public.customers c
    LEFT JOIN public.appointments a
      ON a.barbershop_id = p_barbershop_id
     AND a.manual_customer_id = c.id
    WHERE c.barbershop_id = p_barbershop_id
      AND NOT COALESCE(c.auth, false)
    GROUP BY c.id
  ),
  authenticated_customers AS (
    SELECT
      c.id,
      p_barbershop_id AS barbershop_id,
      COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome') AS name,
      c.phone,
      MIN(COALESCE(a.created_at, c.created_at)) AS created_at,
      c.updated_at,
      c.auth,
      c.auth_user_id,
      'customers_auth'::text AS source,
      COUNT(a.id) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      )::integer AS total_appointments,
      MAX(a.starts_at) FILTER (
        WHERE a.status::text NOT IN ('cancelled_by_customer', 'cancelled_by_barbershop')
      ) AS last_appointment
    FROM public.appointments a
    JOIN public.customers c
      ON c.id = a.customer_id
     AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND a.customer_id IS NOT NULL
    GROUP BY c.id
  ),
  merged AS (
    SELECT * FROM manual_customers
    UNION ALL
    SELECT * FROM authenticated_customers
  ),
  ranked AS (
    SELECT
      m.*,
      SUM(m.total_appointments) OVER (PARTITION BY
        COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
      )::integer AS combined_total_appointments,
      MAX(m.last_appointment) OVER (PARTITION BY
        COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
      ) AS combined_last_appointment,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(
          NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), ''),
          'id:' || m.id::text
        )
        ORDER BY CASE WHEN m.source = 'customers_auth' THEN 0 ELSE 1 END,
                 m.created_at DESC,
                 m.id DESC
      ) AS identity_rank
    FROM merged m
  ),
  deduplicated AS (
    SELECT
      id, barbershop_id, name, phone, created_at, updated_at, auth,
      auth_user_id, source,
      combined_total_appointments AS total_appointments,
      combined_last_appointment AS last_appointment
    FROM ranked
    WHERE identity_rank = 1
  ),
  filtered AS (
    SELECT *
    FROM deduplicated m
    WHERE v_search IS NULL
       OR m.name ILIKE '%' || v_search || '%'
       OR (v_search_phone IS NOT NULL AND COALESCE(m.phone, '') LIKE '%' || v_search_phone || '%')
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER ()::integer AS full_count
    FROM filtered f
  ),
  paged AS (
    SELECT *
    FROM counted
    ORDER BY created_at DESC, id DESC
    LIMIT v_page_size
    OFFSET (v_page - 1) * v_page_size
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
  INTO v_total, v_items
  FROM paged;

  -- An empty page has no window row from which to read the total.
  IF v_total = 0 AND v_page > 1 THEN
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
    SELECT COUNT(DISTINCT identity_key)::integer
    INTO v_total
    FROM all_ids m
    WHERE v_search IS NULL
       OR m.name ILIKE '%' || v_search || '%'
       OR (v_search_phone IS NOT NULL AND COALESCE(m.phone, '') LIKE '%' || v_search_phone || '%');
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', CASE WHEN v_total = 0 THEN 0 ELSE CEIL(v_total::numeric / v_page_size)::integer END
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.create_customer(
  p_barbershop_id uuid,
  p_name text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_name text := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_customer public.customers%ROWTYPE;
  v_conflict jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
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
            AND bm.role::text IN ('admin', 'writer')
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'name');
  END IF;
  IF length(v_phone) NOT IN (10, 11) THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'phone');
  END IF;

  SELECT candidate.payload
  INTO v_conflict
  FROM (
    SELECT
      2 AS priority,
      c.created_at AS sort_date,
      jsonb_build_object(
        'id', c.id, 'barbershop_id', c.barbershop_id, 'name', c.name,
        'phone', c.phone, 'created_at', c.created_at, 'updated_at', c.updated_at,
        'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers',
        'total_appointments', 0, 'last_appointment', NULL
      ) AS payload
    FROM public.customers c
    WHERE c.barbershop_id = p_barbershop_id
      AND NOT COALESCE(c.auth, false)
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone

    UNION ALL

    SELECT
      1,
      MIN(COALESCE(a.created_at, c.created_at)),
      jsonb_build_object(
        'id', c.id, 'barbershop_id', p_barbershop_id, 'name', COALESCE(NULLIF(BTRIM(c.name), ''), 'Cliente sem nome'),
        'phone', c.phone, 'created_at', MIN(COALESCE(a.created_at, c.created_at)), 'updated_at', c.updated_at,
        'auth', c.auth, 'auth_user_id', c.auth_user_id, 'source', 'customers_auth',
        'total_appointments', COUNT(a.id)::integer, 'last_appointment', MAX(a.starts_at)
      )
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    GROUP BY c.id
  ) candidate
  ORDER BY candidate.priority, candidate.sort_date DESC
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict);
  END IF;

  BEGIN
    INSERT INTO public.customers (barbershop_id, name, phone)
    VALUES (p_barbershop_id, v_name, v_phone)
    RETURNING * INTO v_customer;
  EXCEPTION WHEN unique_violation THEN
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

    IF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict);
    END IF;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'status', 'created',
    'customer', jsonb_build_object(
      'id', v_customer.id, 'barbershop_id', v_customer.barbershop_id,
      'name', v_customer.name, 'phone', v_customer.phone,
      'created_at', v_customer.created_at, 'updated_at', v_customer.updated_at,
      'auth', v_customer.auth, 'auth_user_id', v_customer.auth_user_id,
      'source', 'customers', 'total_appointments', 0, 'last_appointment', NULL
    )
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_customer(
  p_barbershop_id uuid,
  p_customer_id uuid,
  p_name text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_name text := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_customer public.customers%ROWTYPE;
  v_conflict jsonb;
  v_total integer := 0;
  v_last timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
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
            AND bm.role::text IN ('admin', 'writer')
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'name');
  END IF;
  IF length(v_phone) NOT IN (10, 11) THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'phone');
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.barbershop_id = p_barbershop_id
    AND NOT COALESCE(c.auth, false)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
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

  IF v_conflict IS NULL THEN
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

  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'conflict', 'existing', v_conflict);
  END IF;

  BEGIN
    UPDATE public.customers
    SET name = v_name,
        phone = v_phone,
        updated_at = now()
    WHERE id = p_customer_id
    RETURNING * INTO v_customer;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'conflict');
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

  RETURN jsonb_build_object(
    'status', 'updated',
    'customer', jsonb_build_object(
      'id', v_customer.id, 'barbershop_id', v_customer.barbershop_id,
      'name', v_customer.name, 'phone', v_customer.phone,
      'created_at', v_customer.created_at, 'updated_at', v_customer.updated_at,
      'auth', v_customer.auth, 'auth_user_id', v_customer.auth_user_id,
      'source', 'customers', 'total_appointments', v_total, 'last_appointment', v_last
    )
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.delete_customer(
  p_barbershop_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_future_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
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
            AND bm.role::text IN ('admin', 'writer')
        )
      )
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.barbershop_id = p_barbershop_id
    AND NOT COALESCE(c.auth, false)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT COUNT(*)::integer
  INTO v_future_count
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id
    AND a.manual_customer_id = p_customer_id
    AND a.starts_at >= now()
    AND a.status::text NOT IN (
      'completed', 'cancelled_by_customer', 'cancelled_by_barbershop', 'no_show'
    );

  IF v_future_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'reason', 'future_appointments',
      'future_appointments', v_future_count
    );
  END IF;

  -- The check, snapshot unlink and delete run in the same transaction/lock.
  UPDATE public.appointments
  SET manual_customer_id = NULL
  WHERE barbershop_id = p_barbershop_id
    AND manual_customer_id = p_customer_id;

  DELETE FROM public.customers
  WHERE id = p_customer_id
    AND barbershop_id = p_barbershop_id;

  RETURN jsonb_build_object('status', 'deleted', 'customer_id', p_customer_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_customer_history(
  p_barbershop_id uuid,
  p_customer_id uuid,
  p_source text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50);
  v_total integer := 0;
  v_last timestamptz;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
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

  IF p_source NOT IN ('customers', 'customers_auth') THEN
    RETURN jsonb_build_object('status', 'invalid', 'field', 'source');
  END IF;

  IF p_source = 'customers' AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.barbershop_id = p_barbershop_id
      AND NOT COALESCE(c.auth, false)
  ) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF p_source = 'customers_auth' AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id AND COALESCE(c.auth, false)
    WHERE a.barbershop_id = p_barbershop_id
      AND a.customer_id = p_customer_id
  ) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT COUNT(*)::integer, MAX(a.starts_at)
  INTO v_total, v_last
  FROM public.appointments a
  WHERE a.barbershop_id = p_barbershop_id
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
    );

  SELECT COALESCE(
    jsonb_agg(row_payload ORDER BY starts_at DESC, id DESC),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT
      a.id,
      a.starts_at,
      jsonb_build_object(
        'id', a.id,
        'starts_at', a.starts_at,
        'status', a.status,
        'service_name', COALESCE(a.service_name, s.name, 'Serviço removido'),
        'barber_name', COALESCE(a.barber_name, b.name)
      ) AS row_payload
    FROM public.appointments a
    LEFT JOIN public.services s
      ON s.id = a.service_id AND s.barbershop_id = a.barbershop_id
    LEFT JOIN public.barbers b
      ON b.id = a.barber_id AND b.barbershop_id = a.barbershop_id
    WHERE a.barbershop_id = p_barbershop_id
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
    ORDER BY a.starts_at DESC, a.id DESC
    LIMIT v_page_size
    OFFSET (v_page - 1) * v_page_size
  ) history_rows;

  RETURN jsonb_build_object(
    'status', 'ok',
    'items', v_items,
    'total', v_total,
    'last_appointment', v_last,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', CASE WHEN v_total = 0 THEN 0 ELSE CEIL(v_total::numeric / v_page_size)::integer END
  );
END;
$function$;


-- Supporting indexes for server-side search, joins and future-appointment checks.
CREATE INDEX IF NOT EXISTS idx_customers_barbershop_created_at
  ON public.customers (barbershop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_barbershop_phone
  ON public.customers (barbershop_id, phone);

CREATE INDEX IF NOT EXISTS idx_appointments_shop_manual_customer_starts
  ON public.appointments (barbershop_id, manual_customer_id, starts_at DESC)
  WHERE manual_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_shop_auth_customer_starts
  ON public.appointments (barbershop_id, customer_id, starts_at DESC)
  WHERE customer_id IS NOT NULL;

REVOKE ALL ON FUNCTION public.get_customers(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_customer(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_customer(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_customer(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_history(uuid, uuid, text, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_customers(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_customer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_history(uuid, uuid, text, integer, integer) TO authenticated;
