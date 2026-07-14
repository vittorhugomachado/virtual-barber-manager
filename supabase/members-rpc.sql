-- Gerenciamento de membros: execute manualmente no SQL Editor do Supabase.
-- Estas funcoes sao internas das Edge Functions. O frontend autenticado nao
-- recebe permissao de execucao; somente a service_role pode chama-las.

CREATE OR REPLACE FUNCTION public.register_barbershop_member(
  p_owner_id uuid,
  p_barbershop_id uuid,
  p_user_id uuid,
  p_username text,
  p_role text,
  p_max_members integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.update_barbershop_member_record(
  p_owner_id uuid,
  p_member_id uuid,
  p_username text DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;


REVOKE ALL ON FUNCTION public.register_barbershop_member(uuid, uuid, uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_barbershop_member(uuid, uuid, uuid, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.register_barbershop_member(uuid, uuid, uuid, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.register_barbershop_member(uuid, uuid, uuid, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.update_barbershop_member_record(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_barbershop_member_record(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_barbershop_member_record(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_barbershop_member_record(uuid, uuid, text, text) TO service_role;
