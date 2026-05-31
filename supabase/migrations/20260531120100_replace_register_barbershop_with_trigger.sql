-- =============================================================================
-- ACHADO 1 (CRÍTICO) — Substitui register_barbershop por um trigger em
-- auth.users.
--
-- Problema: register_barbershop recebia p_user_id do CLIENTE e tinha como
-- única barreira de autorização "usuário criado nos últimos 5 minutos".
-- Como é SECURITY DEFINER (ignora RLS), qualquer chamador que conhecesse o
-- UUID de um cadastro recente podia criar/sobrescrever profile + barbershop
-- em nome de outra pessoa, e ainda gravava email vindo do cliente (achado 6).
--
-- Correção: a criação passa a acontecer dentro de um trigger AFTER INSERT em
-- auth.users, na MESMA transação do signUp. O identificador do dono é NEW.id
-- (jamais um parâmetro do cliente) e o email é NEW.email (verificado pelo
-- Auth). Os dados de negócio chegam via raw_user_meta_data preenchido no
-- signUp do frontend.
--
-- Segurança contra metadata adulterado: o cliente controla raw_user_meta_data,
-- então `role` é FIXADO no servidor ('barbershop' literal) e nunca lido do
-- metadata. O trigger só age quando role = 'barbershop' E há barbershop_name,
-- ignorando membros (criados via admin API) e demais papéis.
--
-- ATENÇÃO: nenhum outro trigger em auth.users deve copiar
-- raw_user_meta_data->>'role' para profiles.role — isso seria escalada de
-- privilégio (cliente poderia se autopromover a 'master').
-- =============================================================================

create or replace function public.handle_new_barbershop_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role            text  := v_meta->>'role';
  v_owner_name      text  := v_meta->>'name';
  v_phone_raw       text  := v_meta->>'phone';
  v_barbershop_name text  := v_meta->>'barbershop_name';
  v_barbershop_id   uuid  := gen_random_uuid();
  v_id_clean        text  := replace(v_barbershop_id::text, '-', '');
  v_base_slug       text;
  v_slug            text;
begin
  -- Atua somente em cadastros de DONO de barbearia. Membros (criados via Edge
  -- Function com admin API) e outros papéis caem fora aqui.
  if v_role is distinct from 'barbershop' or v_barbershop_name is null then
    return new;
  end if;

  -- Idempotência: se já existe barbershop para este usuário, não faz nada.
  if exists (select 1 from public.barbershops where owner_id = new.id) then
    return new;
  end if;

  -- Telefone duplicado (defesa extra; o UNIQUE em barbershops.phone garante a
  -- integridade). Se disparar, o signUp inteiro falha — aceitável, pois o
  -- frontend já pré-valida via check_phone_exists antes do signUp.
  if v_phone_raw is not null and exists (
    select 1 from public.barbershops where phone = '55' || v_phone_raw
  ) then
    raise exception 'phone_already_exists';
  end if;

  -- Slug base: remove acentos, caracteres especiais e troca espaços por hífen.
  v_base_slug := regexp_replace(
    regexp_replace(
      translate(
        lower(v_barbershop_name),
        'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
        'aaaaaaeeeeiiiioooooouuuuyycon'
      ),
      '[^a-z0-9\s-]',
      '',
      'g'
    ),
    '\s+',
    '-',
    'g'
  );

  -- Achado 9: remove hífens das pontas e evita slug vazio (nome só com
  -- caracteres especiais geraria '').
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug is null or v_base_slug = '' then
    v_base_slug := 'barbearia';
  end if;

  -- Fallbacks de colisão: base -> base-{4} -> base-{15}.
  v_slug := v_base_slug;
  if exists (select 1 from public.barbershops where slug = v_slug) then
    v_slug := v_base_slug || '-' || left(v_id_clean, 4);
    if exists (select 1 from public.barbershops where slug = v_slug) then
      v_slug := v_base_slug || '-' || left(v_id_clean, 15);
    end if;
  end if;

  -- Perfil do dono. role é FIXO no servidor; jamais vem do metadata.
  insert into public.profiles (id, role, name)
  values (new.id, 'barbershop', v_owner_name)
  on conflict (id) do update
    set role = 'barbershop',
        name = excluded.name;

  -- Barbearia. email = new.email (verificado pelo Auth, não pelo cliente).
  insert into public.barbershops (id, owner_id, name, slug, email, phone)
  values (
    v_barbershop_id,
    new.id,
    v_barbershop_name,
    v_slug,
    new.email,
    case when v_phone_raw is null then null else '55' || v_phone_raw end
  );

  -- Estilo default da loja.
  insert into public.store_style (barbershop_id)
  values (v_barbershop_id);

  return new;
end;
$$;

-- O trigger só pode ser criado/executado por quem é dono do schema auth
-- (a role da migration, ex.: postgres/supabase_admin).
drop trigger if exists trg_handle_new_barbershop_user on auth.users;
create trigger trg_handle_new_barbershop_user
  after insert on auth.users
  for each row
  execute function public.handle_new_barbershop_user();

-- Remove a RPC vulnerável. A partir daqui o frontend NÃO deve mais chamá-la
-- (ver alteração em src/components/forms/signup-form.tsx). Deploy do banco e
-- do frontend devem ir juntos.
drop function if exists public.register_barbershop(uuid, text, text, text, text);
