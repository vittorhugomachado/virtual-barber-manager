-- ============================================================================
-- fix-pix-renewal.sql  (#9)
-- Rodar no Supabase > SQL Editor ANTES de redeployar as edge functions.
--
-- Adiciona subscriptions.pending_period_end: o fim do período calculado pela
-- edge function PRESERVANDO os dias restantes da renovação. No PIX (que confirma
-- depois), o webhook usa este valor ao ativar, em vez de ancorar só no dueDate
-- — assim a renovação antecipada via PIX não perde os dias que faltavam.
--
-- IMPORTANTE: este campo NÃO libera acesso. Só `current_period_end` (via
-- is_barbershop_active) libera. pending_period_end é apenas uma "dica" que o
-- webhook consome (e zera) ao confirmar o pagamento.
-- ============================================================================

alter table public.subscriptions
  add column if not exists pending_period_end timestamptz;
