-- =============================================================================
-- Cron de conversão automática de agendamentos atrasados em "não compareceu"
-- =============================================================================
-- Execute este arquivo manualmente no SQL Editor do Supabase, depois de executar
-- appointments-rpc.sql.
--
-- Regra:
--   todo agendamento que continuar como "scheduled" por mais de uma hora após
--   starts_at será alterado para "no_show".
--
-- Segurança e consistência:
--   * concluídos, cancelados e ausências já registradas nunca são alterados;
--   * a operação é idempotente: executar várias vezes produz o mesmo resultado;
--   * o filtro por status protege contra sobrescrita de uma alteração concorrente;
--   * starts_at é timestamptz, portanto a comparação não depende da timezone;
--   * a função não fica disponível para chamadas pelo navegador.
-- =============================================================================

BEGIN;

-- O Supabase Cron usa a extensão pg_cron como mecanismo de agendamento.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Acelera a procura pelas poucas linhas ainda agendadas que já venceram.
-- O índice parcial também permanece pequeno porque ignora todos os outros status.
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_starts_at
  ON public.appointments (starts_at)
  WHERE status = 'scheduled'::public.appointment_status;

-- Atualiza somente agendamentos que ainda estejam como agendados e cujo início
-- tenha ocorrido há mais de uma hora. O total alterado é retornado para facilitar
-- testes manuais e observabilidade no histórico de execuções do Cron.
CREATE OR REPLACE FUNCTION public.mark_overdue_appointments_as_no_show()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  UPDATE public.appointments
  SET
    status = 'no_show'::public.appointment_status,
    updated_at = now()
  WHERE status = 'scheduled'::public.appointment_status
    AND starts_at < now() - interval '1 hour';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$function$;

-- A função é interna e não pode ser acionada por clientes anon ou authenticated.
REVOKE ALL ON FUNCTION public.mark_overdue_appointments_as_no_show()
  FROM PUBLIC, anon, authenticated;

-- Executa a cada 10 minutos. Reexecutar este script com o mesmo nome atualiza
-- o job existente em vez de criar vários jobs equivalentes.
SELECT cron.schedule(
  'appointments-auto-no-show',
  '*/10 * * * *',
  'SELECT public.mark_overdue_appointments_as_no_show()'
);

COMMIT;

-- =============================================================================
-- Consultas úteis após a instalação (execute separadamente se desejar)
-- =============================================================================
-- Ver o job criado:
-- SELECT jobid, jobname, schedule, active
-- FROM cron.job
-- WHERE jobname = 'appointments-auto-no-show';
--
-- Testar a função imediatamente:
-- SELECT public.mark_overdue_appointments_as_no_show();
--
-- Ver as últimas execuções:
-- SELECT jobid, status, return_message, start_time, end_time
-- FROM cron.job_run_details
-- WHERE jobid = (
--   SELECT jobid FROM cron.job WHERE jobname = 'appointments-auto-no-show'
-- )
-- ORDER BY start_time DESC
-- LIMIT 20;
--
-- Remover o agendamento, caso necessário:
-- SELECT cron.unschedule('appointments-auto-no-show');
