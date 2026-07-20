-- =============================================================================
-- Teste manual do Cron de "não compareceu"
-- =============================================================================
-- Pré-requisito:
--   execute primeiro appointments-auto-no-show-cron.sql para criar a função e
--   registrar o job.
--
-- ATENÇÃO:
--   este teste executa a regra de verdade. Agendamentos que ainda estiverem como
--   "scheduled" e tenham começado há mais de uma hora serão permanentemente
--   alterados para "no_show" ao final da transação.
-- =============================================================================

BEGIN;

-- Guarda somente os IDs que devem ser alcançados por esta execução. A tabela é
-- temporária e será removida automaticamente no COMMIT.
CREATE TEMP TABLE appointments_auto_no_show_test_candidates
ON COMMIT DROP
AS
SELECT
  id,
  barbershop_id,
  starts_at,
  status AS status_before
FROM public.appointments
WHERE status = 'scheduled'::public.appointment_status
  AND starts_at < now() - interval '1 hour';

-- Resultado 1: quantidade que deve ser atualizada neste teste.
SELECT COUNT(*) AS candidates_before_execution
FROM appointments_auto_no_show_test_candidates;

-- Resultado 2: executa imediatamente a mesma função chamada pelo Cron.
-- O valor retornado deve ser igual a candidates_before_execution, desde que
-- nenhuma outra transação altere os mesmos agendamentos simultaneamente.
SELECT public.mark_overdue_appointments_as_no_show() AS updated_by_function;

-- Resultado 3: confirma o estado de cada registro que era candidato.
-- Todos devem aparecer com status_after = no_show.
SELECT
  candidate.id,
  candidate.barbershop_id,
  candidate.starts_at,
  candidate.status_before,
  appointment.status AS status_after,
  appointment.updated_at,
  appointment.status = 'no_show'::public.appointment_status AS test_passed
FROM appointments_auto_no_show_test_candidates candidate
JOIN public.appointments appointment ON appointment.id = candidate.id
ORDER BY candidate.starts_at;

COMMIT;

-- Resultado 4: confirma que o job recorrente está registrado e ativo.
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'appointments-auto-no-show';

-- Resultado 5: mostra execuções automáticas que o pg_cron já realizou.
-- Logo após a instalação esta consulta pode retornar zero linhas; isso é normal
-- até chegar o próximo intervalo de 10 minutos.
SELECT
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid
  FROM cron.job
  WHERE jobname = 'appointments-auto-no-show'
)
ORDER BY start_time DESC
LIMIT 20;
