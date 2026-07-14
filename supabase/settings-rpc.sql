-- Configurações da barbearia: execute manualmente no SQL Editor do Supabase.
-- Este arquivo somente define funções, permissões e policies; ele não executa
-- nenhuma alteração de cadastro ou upload por conta própria.

CREATE OR REPLACE FUNCTION public.get_settings_alerts(p_barbershop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.update_barbershop_settings(
  p_barbershop_id uuid,
  p_name text,
  p_phone text,
  p_slug text,
  p_description text DEFAULT NULL,
  p_owner_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
  IF length(v_phone) <> 11 THEN
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
$function$;


CREATE OR REPLACE FUNCTION public.update_barbershop_asset(
  p_barbershop_id uuid,
  p_asset_type text,
  p_asset_url text,
  p_storage_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;


-- Lista somente os membros da barbearia pertencente ao owner autenticado.
-- A leitura fica centralizada no banco e não depende de contornar o RLS no front.
CREATE OR REPLACE FUNCTION public.get_barbershop_members(p_barbershop_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role public.member_role,
  username text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;


REVOKE ALL ON FUNCTION public.get_settings_alerts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_barbershop_settings(uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_barbershop_asset(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_email_exists(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_barbershop_members(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_settings_alerts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_barbershop_settings(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_barbershop_asset(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_barbershop_members(uuid) TO authenticated;


-- Corrige as policies existentes mantendo o mesmo modelo: assets públicos para
-- leitura e escrita somente pelo owner da pasta ou admin da mesma barbearia.
DROP POLICY IF EXISTS "admin or owner can upload to barbershop-assets" ON storage.objects;
CREATE POLICY "admin or owner can upload to barbershop-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'barbershop-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.barbershop_members bm
      JOIN public.barbershops b ON b.id = bm.barbershop_id
      WHERE bm.user_id = auth.uid()
        AND bm.role::text = 'admin'
        AND b.owner_id::text = (storage.foldername(name))[1]
    )
  )
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  AND metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp')
  AND metadata->>'size' ~ '^[0-9]+$'
  AND (metadata->>'size')::bigint BETWEEN 1 AND 5242880
);

DROP POLICY IF EXISTS "admin or owner can update barbershop-assets" ON storage.objects;
CREATE POLICY "admin or owner can update barbershop-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'barbershop-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.barbershop_members bm
      JOIN public.barbershops b ON b.id = bm.barbershop_id
      WHERE bm.user_id = auth.uid()
        AND bm.role::text = 'admin'
        AND b.owner_id::text = (storage.foldername(name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'barbershop-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.barbershop_members bm
      JOIN public.barbershops b ON b.id = bm.barbershop_id
      WHERE bm.user_id = auth.uid()
        AND bm.role::text = 'admin'
        AND b.owner_id::text = (storage.foldername(name))[1]
    )
  )
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  AND metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp')
  AND metadata->>'size' ~ '^[0-9]+$'
  AND (metadata->>'size')::bigint BETWEEN 1 AND 5242880
);

DROP POLICY IF EXISTS "admin or owner can delete from barbershop-assets" ON storage.objects;
CREATE POLICY "admin or owner can delete from barbershop-assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'barbershop-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.barbershop_members bm
      JOIN public.barbershops b ON b.id = bm.barbershop_id
      WHERE bm.user_id = auth.uid()
        AND bm.role::text = 'admin'
        AND b.owner_id::text = (storage.foldername(name))[1]
    )
  )
);
