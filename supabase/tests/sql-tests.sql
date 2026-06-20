-- ============================================================================
-- sql-tests.sql — testes dos fixes que vivem no banco (#4, #5, #8, #11).
-- Rodar no Supabase > SQL Editor. NÃO persiste nada (self-cleaning / ROLLBACK).
-- Resultados saem como NOTICE no painel de mensagens. Procure "RESULTADO: PASS".
--
-- Rode DEPOIS de aplicar critical-fixes.sql e medium-light-fixes.sql.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- #8  has_active_access deve ser IGUAL a is_barbershop_active (fonte única)
-- ----------------------------------------------------------------------------
do $$
declare r record; mismatches int := 0; total int := 0;
begin
  for r in select id from public.barbershops loop
    total := total + 1;
    if public.has_active_access(r.id) is distinct from public.is_barbershop_active(r.id) then
      mismatches := mismatches + 1;
    end if;
  end loop;
  raise notice '#8  divergencias=% de % barbearias  -> RESULTADO: %',
    mismatches, total, case when mismatches = 0 then 'PASS' else 'FAIL' end;
end $$;


-- ----------------------------------------------------------------------------
-- #11 Privilégios: anon NÃO executa validate_coupon nem as RPCs de cupom.
-- ----------------------------------------------------------------------------
do $$
declare anon_vc bool; auth_vc bool; anon_inc bool; svc_inc bool; anon_dec bool;
begin
  anon_vc  := has_function_privilege('anon','public.validate_coupon(text)','execute');
  auth_vc  := has_function_privilege('authenticated','public.validate_coupon(text)','execute');
  anon_inc := has_function_privilege('anon','public.increment_coupon_usage(uuid)','execute');
  svc_inc  := has_function_privilege('service_role','public.increment_coupon_usage(uuid)','execute');
  anon_dec := has_function_privilege('anon','public.decrement_coupon_usage(uuid)','execute');
  raise notice '#11 validate_coupon       anon=% (f)  authenticated=% (t)', anon_vc, auth_vc;
  raise notice '#11 increment_coupon_usage anon=% (f)  service_role=% (t)', anon_inc, svc_inc;
  raise notice '#11 decrement_coupon_usage anon=% (f)', anon_dec;
  raise notice '#11 RESULTADO: %',
    case when anon_vc = false and auth_vc = true
              and anon_inc = false and svc_inc = true
              and anon_dec = false
         then 'PASS' else 'FAIL' end;
end $$;


-- ----------------------------------------------------------------------------
-- #4  increment_coupon_usage é atômico e respeita max_uses; decrement libera.
--     (cria um cupom de teste e o apaga no fim — não persiste)
-- ----------------------------------------------------------------------------
do $$
declare v_id uuid; v1 bool; v2 bool; v_count int; v_after int;
begin
  insert into public.coupons (code, discount_type, discount_value, max_uses, uses_count, is_active)
  values ('__test_atomic_'||substr(md5(random()::text),1,6)||'__', 'fixed', 10, 1, 0, true)
  returning id into v_id;

  v1 := public.increment_coupon_usage(v_id);   -- 0 -> 1 : true
  v2 := public.increment_coupon_usage(v_id);   -- 1 nao < 1 : false (nao estoura)
  select uses_count into v_count from public.coupons where id = v_id;   -- 1
  perform public.decrement_coupon_usage(v_id);
  select uses_count into v_after from public.coupons where id = v_id;   -- 0

  delete from public.coupons where id = v_id;  -- limpa

  raise notice '#4  1a=% (t)  2a=% (f)  uses_count=% (1)  apos_decrement=% (0)',
    v1, v2, v_count, v_after;
  raise notice '#4  RESULTADO: %',
    case when v1 and not v2 and v_count = 1 and v_after = 0 then 'PASS' else 'FAIL' end;
end $$;


-- ----------------------------------------------------------------------------
-- #5a cleanup_unverified_users roda SEM erro de FK nos dados reais.
--     Roda dentro de uma transação que é DESFEITA (rollback) — nada some.
--     Se algum FK não estivesse tratado, o cleanup estouraria aqui.
-- ----------------------------------------------------------------------------
begin;
do $$
declare antes int; depois int;
begin
  select count(*) into antes from auth.users
    where email_confirmed_at is null and created_at < now() - interval '48 hours';
  perform public.cleanup_unverified_users();   -- se houver FK violation, estoura
  select count(*) into depois from auth.users
    where email_confirmed_at is null and created_at < now() - interval '48 hours';
  raise notice '#5a cleanup rodou sem erro. alvos antes=% depois=% (esperado 0)', antes, depois;
  raise notice '#5a RESULTADO: %', case when depois = 0 then 'PASS' else 'FAIL' end;
end $$;
rollback;


-- ----------------------------------------------------------------------------
-- #5b (OPCIONAL) Cria um alvo SINTÉTICO (usuário não-verificado + barbearia +
--     subscription) e prova que o cleanup apaga sem estourar a FK
--     subscriptions->barbershops (o bug original). Transação desfeita no fim.
--     OBS: o INSERT em auth.users pode precisar de ajuste conforme a versão.
-- ----------------------------------------------------------------------------
begin;
do $$
declare v_uid uuid := gen_random_uuid(); v_bid uuid := gen_random_uuid(); v_rest int;
begin
  -- usuário não-verificado de 72h, SEM metadata 'barbershop' (não dispara a trigger)
  insert into auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data)
  values (v_uid, 'cleanup_'||substr(v_uid::text,1,8)||'@example.invalid',
          now() - interval '72 hours', null, '{}'::jsonb);

  insert into public.profiles (id, role, name) values (v_uid, 'barbershop', 'Teste Cleanup');
  insert into public.barbershops (id, owner_id, name, slug, email)
  values (v_bid, v_uid, 'Teste Cleanup',
          'teste-cleanup-'||substr(v_bid::text,1,8),
          'cleanup_'||substr(v_bid::text,1,8)||'@example.invalid');
  -- a subscription é o filho que causava o FK violation no fix antigo:
  insert into public.subscriptions (barbershop_id, plan_id, status, trial_ends_at)
  values (v_bid, null, 'trialing', now() + interval '30 days');

  perform public.cleanup_unverified_users();   -- precisa apagar subscription antes da barbershop

  select count(*) into v_rest from public.barbershops where id = v_bid;
  raise notice '#5b barbershop sintetica restante=% (esperado 0)', v_rest;
  raise notice '#5b RESULTADO: %', case when v_rest = 0 then 'PASS' else 'FAIL' end;
exception when others then
  raise notice '#5b FALHOU com erro: % (provavel FK nao tratada OU ajuste no insert de auth.users)', sqlerrm;
end $$;
rollback;
