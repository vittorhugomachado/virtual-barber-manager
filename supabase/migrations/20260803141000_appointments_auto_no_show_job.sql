-- Mantém exatamente um job responsável por converter agendamentos atrasados
-- que ainda estejam como "scheduled" para "no_show".
--
-- A função chamada pelo job e a extensão pg_cron fazem parte da migration-base.
-- Remover jobs anteriores pelo jobid torna esta migration segura mesmo se o
-- agendamento tiver sido criado manualmente mais de uma vez antes do baseline.

DO $migration$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'appointments-auto-no-show'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'appointments-auto-no-show',
    '*/10 * * * *',
    'SELECT public.mark_overdue_appointments_as_no_show()'
  );
END;
$migration$;
