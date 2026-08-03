-- Testes automatizados da agenda administrativa.
-- Executar somente no Supabase local:
--   supabase test db supabase/tests/appointments-rpc.test.sql

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

SET search_path = public, extensions, auth, pg_catalog;

SELECT no_plan();

-- IDs determinísticos tornam o teste repetível e permitem limpar uma execução
-- interrompida antes de criar os fixtures novamente.
DELETE FROM public.appointments
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.subscriptions
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.store_style
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.barbershops
WHERE id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.profiles
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);
DELETE FROM auth.users
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001', 'authenticated',
    'authenticated', 'appointments-owner@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000002', 'authenticated',
    'authenticated', 'appointments-admin@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000003', 'authenticated',
    'authenticated', 'appointments-reader@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000004', 'authenticated',
    'authenticated', 'appointments-outsider@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

INSERT INTO public.profiles (id, name, role)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Owner Teste', 'barbershop'),
  ('10000000-0000-0000-0000-000000000002', 'Admin Teste', 'barbershop_member'),
  ('10000000-0000-0000-0000-000000000003', 'Reader Teste', 'barbershop_member'),
  ('10000000-0000-0000-0000-000000000004', 'Outsider Teste', 'barbershop_member');

INSERT INTO public.barbershops (
  id, owner_id, name, slug, is_active, timezone, onboarding_completed
)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Barbearia Teste Agenda', 'barbearia-teste-agenda', true,
  'America/Sao_Paulo', true
);

INSERT INTO public.subscriptions (
  id, barbershop_id, status, current_period_end, grace_period_days
)
VALUES (
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'active', now() + interval '30 days', 6
);

INSERT INTO public.barbershop_members (
  barbershop_id, user_id, role, username
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'admin', 'appointments-admin'
  ),
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'reader', 'appointments-reader'
  );

INSERT INTO public.customers (
  id, barbershop_id, name, phone, auth
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Cliente Teste', '5511999999999', false
);

INSERT INTO public.barbers (
  id, barbershop_id, name, is_active
)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Profissional Teste', true
);

INSERT INTO public.services (
  id, barbershop_id, name, duration_min, price, is_active
)
VALUES (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Serviço Teste', 30, 50, true
);

INSERT INTO public.barber_services (barber_id, service_id)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001'
);

INSERT INTO public.opening_hours (
  barbershop_id, day_of_week, opens_at, closes_at, is_open, period_order
)
SELECT
  '20000000-0000-0000-0000-000000000001',
  day_of_week, time '08:00', time '20:00', true, 0
FROM generate_series(0, 6) AS day_of_week;

-- Privilégios: o navegador chama RPCs, nunca escreve/manipula a tabela.
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_appointment_booking_context(uuid)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.get_available_appointment_slots(uuid,uuid,uuid,date)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.get_manager_appointments(uuid,date,date,integer)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.create_manager_appointments(uuid,uuid,text,date,jsonb,uuid)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.change_manager_appointment_status(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated executa somente as RPCs públicas da agenda'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_manager_appointments(uuid,date,date,integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.create_manager_appointments(uuid,uuid,text,date,jsonb,uuid)',
    'EXECUTE'
  ),
  'anon não executa RPCs administrativas da agenda'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.assert_appointment_read_access(uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.assert_appointment_write_access(uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.mark_overdue_appointments_as_no_show()',
    'EXECUTE'
  ),
  'helpers internos e cron não são expostos ao navegador'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.appointments', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.appointments', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.appointments', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.appointments', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.appointments', 'TRUNCATE')
  AND NOT has_table_privilege('authenticated', 'public.appointments', 'TRIGGER')
  AND NOT has_table_privilege('authenticated', 'public.appointments', 'REFERENCES'),
  'authenticated possui apenas SELECT direto sob RLS'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.appointments', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.appointments', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.appointments', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.appointments', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.appointments', 'TRUNCATE'),
  'anon não possui acesso direto à tabela appointments'
);

-- Leitura: reader pode consultar; usuário sem vínculo não pode.
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000003',
  false
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  false
);
SET ROLE authenticated;

SELECT lives_ok(
  $sql$
    SELECT public.get_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 7),
      100
    )
  $sql$,
  'reader pode visualizar a agenda'
);

SELECT throws_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '09:00'
      )),
      '70000000-0000-0000-0000-000000000009'
    )
  $sql$,
  '42501',
  'not_allowed',
  'reader não pode criar agendamento'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000004',
  false
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  false
);
SET ROLE authenticated;

SELECT throws_ok(
  $sql$
    SELECT public.get_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 7),
      100
    )
  $sql$,
  '42501',
  'not_allowed',
  'usuário sem vínculo não visualiza a agenda'
);

-- Owner ativo: disponibilidade, criação, snapshots, timezone e idempotência.
RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  false
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  false
);
SET ROLE authenticated;

SELECT is(
  jsonb_array_length(
    public.get_appointment_booking_context(
      '20000000-0000-0000-0000-000000000001'
    )->'services'
  ),
  1,
  'contexto retorna o serviço ativo da barbearia'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.get_available_appointment_slots(
        '20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2)
      )->'slots'
    ) AS slot
    WHERE slot->>'time' = '10:00'
      AND (slot->>'available')::boolean
  ),
  'slot futuro começa disponível'
);

SELECT lives_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '10:00'
      )),
      '70000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'owner com assinatura ativa cria agendamento'
);

SELECT lives_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '10:00'
      )),
      '70000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'retry com a mesma chave idempotente retorna o agendamento existente'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)
    FROM public.appointments
    WHERE booking_request_id = '70000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'idempotência persiste uma única linha'
);

SELECT is(
  (
    SELECT starts_at
    FROM public.appointments
    WHERE booking_request_id = '70000000-0000-0000-0000-000000000001'
  ),
  (
    (
      (now() AT TIME ZONE 'America/Sao_Paulo')::date + 2
      + time '10:00'
    ) AT TIME ZONE 'America/Sao_Paulo'
  ),
  'horário local é persistido corretamente como timestamptz'
);

SELECT is(
  (
    SELECT service_name
    FROM public.appointments
    WHERE booking_request_id = '70000000-0000-0000-0000-000000000001'
  ),
  'Serviço Teste',
  'RPC persiste snapshot do serviço no banco'
);

SET ROLE authenticated;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.get_available_appointment_slots(
        '20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2)
      )->'slots'
    ) AS slot
    WHERE slot->>'time' = '10:00'
      AND NOT (slot->>'available')::boolean
  ),
  'slot ocupado deixa de estar disponível'
);

SELECT is(
  public.get_manager_appointments(
    '20000000-0000-0000-0000-000000000001',
    ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
    ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 3),
    100
  )->>'timezone',
  'America/Sao_Paulo',
  'listagem devolve a timezone configurada'
);

SELECT lives_ok(
  format(
    'SELECT public.change_manager_appointment_status(%L::uuid, %L, %L)',
    (
      SELECT id
      FROM public.appointments
      WHERE booking_request_id = '70000000-0000-0000-0000-000000000001'
    ),
    'scheduled',
    'cancelled_by_barbershop'
  ),
  'status futuro pode ser cancelado pela barbearia'
);

SELECT throws_ok(
  format(
    'SELECT public.change_manager_appointment_status(%L::uuid, %L, %L)',
    (
      SELECT id
      FROM public.appointments
      WHERE booking_request_id = '70000000-0000-0000-0000-000000000001'
    ),
    'scheduled',
    'completed'
  ),
  '40001',
  'appointment_changed',
  'status esperado impede sobrescrita concorrente'
);

SELECT lives_ok(
  format(
    'SELECT public.change_manager_appointment_status(%L::uuid, %L, %L)',
    (
      SELECT id
      FROM public.appointments
      WHERE booking_request_id = '70000000-0000-0000-0000-000000000001'
    ),
    'cancelled_by_barbershop',
    'scheduled'
  ),
  'agendamento cancelado pode ser reativado se o slot continuar livre'
);

-- Gate financeiro: carência, vencimento, cancelamento e trial.
RESET ROLE;
UPDATE public.subscriptions
SET status = 'past_due',
    current_period_end = now() - interval '1 day',
    grace_period_days = 6,
    trial_ends_at = NULL
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT lives_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '11:00'
      )),
      '70000000-0000-0000-0000-000000000002'
    )
  $sql$,
  'past_due dentro da carência continua com escrita'
);

RESET ROLE;
UPDATE public.subscriptions
SET current_period_end = now() - interval '7 days'
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT throws_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '12:00'
      )),
      '70000000-0000-0000-0000-000000000003'
    )
  $sql$,
  'P0001',
  'subscription_inactive',
  'past_due depois da carência bloqueia escrita'
);

RESET ROLE;
UPDATE public.subscriptions
SET status = 'canceled', current_period_end = now() + interval '30 days'
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT throws_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '12:00'
      )),
      '70000000-0000-0000-0000-000000000004'
    )
  $sql$,
  'P0001',
  'subscription_inactive',
  'assinatura cancelada bloqueia imediatamente'
);

RESET ROLE;
UPDATE public.subscriptions
SET status = 'trialing',
    current_period_end = NULL,
    trial_ends_at = now() + interval '1 day'
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT lives_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '12:00'
      )),
      '70000000-0000-0000-0000-000000000005'
    )
  $sql$,
  'trial vigente permite escrita'
);

RESET ROLE;
UPDATE public.subscriptions
SET trial_ends_at = now() - interval '1 minute'
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT throws_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '13:00'
      )),
      '70000000-0000-0000-0000-000000000006'
    )
  $sql$,
  'P0001',
  'subscription_inactive',
  'trial vencido bloqueia escrita'
);

RESET ROLE;
UPDATE public.subscriptions
SET status = 'active',
    current_period_end = now() + interval '30 days',
    trial_ends_at = NULL
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
UPDATE public.barbershops
SET is_active = false
WHERE id = '20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT throws_ok(
  $sql$
    SELECT public.create_manager_appointments(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'customers',
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2),
      jsonb_build_array(jsonb_build_object(
        'service_id', '50000000-0000-0000-0000-000000000001',
        'barber_id', '40000000-0000-0000-0000-000000000001',
        'time', '13:00'
      )),
      '70000000-0000-0000-0000-000000000007'
    )
  $sql$,
  'P0001',
  'barbershop_inactive',
  'conta da barbearia desativada bloqueia escrita separadamente'
);

-- Cron: transforma somente agendamento scheduled atrasado em no_show.
RESET ROLE;
UPDATE public.barbershops
SET is_active = true
WHERE id = '20000000-0000-0000-0000-000000000001';

INSERT INTO public.appointments (
  id, barbershop_id, manual_customer_id, barber_id, service_id,
  starts_at, ends_at, status, customer_name, barber_name, service_name,
  service_price, service_duration
)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  now() - interval '2 hours', now() - interval '90 minutes',
  'scheduled', 'Cliente Teste', 'Profissional Teste', 'Serviço Teste',
  50, 30
);

SELECT lives_ok(
  'SELECT public.mark_overdue_appointments_as_no_show()',
  'função automática de no_show executa sem erro'
);

SELECT is(
  (
    SELECT status::text
    FROM public.appointments
    WHERE id = '80000000-0000-0000-0000-000000000001'
  ),
  'no_show',
  'scheduled com mais de uma hora é convertido para no_show'
);

-- Concorrência real: duas conexões disputam o mesmo slot. Ambas consultam a
-- disponibilidade, mas a exclusion constraint permite somente um commit.
SELECT is(
  extensions.dblink_connect(
    'appointments_race_1',
    'host=host.docker.internal port=54322 dbname=' || current_database()
      || ' user=postgres password=postgres'
  ),
  'OK',
  'primeira conexão concorrente aberta'
);
SELECT is(
  extensions.dblink_connect(
    'appointments_race_2',
    'host=host.docker.internal port=54322 dbname=' || current_database()
      || ' user=postgres password=postgres'
  ),
  'OK',
  'segunda conexão concorrente aberta'
);

SELECT extensions.dblink_exec(
  'appointments_race_1',
  'SET request.jwt.claim.sub = ''10000000-0000-0000-0000-000000000001'''
);
SELECT extensions.dblink_exec(
  'appointments_race_2',
  'SET request.jwt.claim.sub = ''10000000-0000-0000-0000-000000000001'''
);
SELECT extensions.dblink_exec(
  'appointments_race_1',
  'SET request.jwt.claims = ''{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}'''
);
SELECT extensions.dblink_exec(
  'appointments_race_2',
  'SET request.jwt.claims = ''{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}'''
);
SELECT extensions.dblink_exec('appointments_race_1', 'SET ROLE authenticated');
SELECT extensions.dblink_exec('appointments_race_2', 'SET ROLE authenticated');

SELECT is(
  extensions.dblink_send_query(
    'appointments_race_1',
    format(
      $query$
        SELECT public.create_manager_appointments(
          '20000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000001',
          'customers', %L::date,
          jsonb_build_array(jsonb_build_object(
            'service_id', '50000000-0000-0000-0000-000000000001',
            'barber_id', '40000000-0000-0000-0000-000000000001',
            'time', '15:00'
          )),
          '70000000-0000-0000-0000-000000000010'
        )
      $query$,
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2)::text
    )
  ),
  1,
  'primeira criação concorrente enviada'
);

SELECT is(
  extensions.dblink_send_query(
    'appointments_race_2',
    format(
      $query$
        SELECT public.create_manager_appointments(
          '20000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000001',
          'customers', %L::date,
          jsonb_build_array(jsonb_build_object(
            'service_id', '50000000-0000-0000-0000-000000000001',
            'barber_id', '40000000-0000-0000-0000-000000000001',
            'time', '15:00'
          )),
          '70000000-0000-0000-0000-000000000011'
        )
      $query$,
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 2)::text
    )
  ),
  1,
  'segunda criação concorrente enviada'
);

CREATE TEMP TABLE appointment_race_results (
  connection_name text PRIMARY KEY,
  error_message text NOT NULL
);

DO $test$
DECLARE
  v_error text;
BEGIN
  PERFORM *
  FROM extensions.dblink_get_result('appointments_race_1', false)
    AS result(payload jsonb);
  v_error := extensions.dblink_error_message('appointments_race_1');
  INSERT INTO appointment_race_results VALUES ('appointments_race_1', v_error);

  PERFORM *
  FROM extensions.dblink_get_result('appointments_race_2', false)
    AS result(payload jsonb);
  v_error := extensions.dblink_error_message('appointments_race_2');
  INSERT INTO appointment_race_results VALUES ('appointments_race_2', v_error);
END;
$test$;

SELECT is(
  (
    SELECT count(*)
    FROM appointment_race_results
    WHERE error_message = 'OK'
  ),
  1::bigint,
  'somente uma requisição concorrente conclui com sucesso'
);

SELECT is(
  (
    SELECT count(*)
    FROM appointment_race_results
    WHERE error_message LIKE '%slot_unavailable%'
  ),
  1::bigint,
  'requisição concorrente perdedora recebe slot_unavailable'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.appointments
    WHERE booking_request_id IN (
      '70000000-0000-0000-0000-000000000010',
      '70000000-0000-0000-0000-000000000011'
    )
  ),
  1::bigint,
  'concorrência persiste apenas um agendamento no slot'
);

SELECT extensions.dblink_disconnect('appointments_race_1');
SELECT extensions.dblink_disconnect('appointments_race_2');

-- Limpeza: o arquivo é seguro para repetição mesmo fora de transação.
RESET ROLE;
DELETE FROM public.appointments
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.subscriptions
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.store_style
WHERE barbershop_id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.barbershops
WHERE id = '20000000-0000-0000-0000-000000000001';
DELETE FROM public.profiles
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);
DELETE FROM auth.users
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);

SELECT * FROM finish();
