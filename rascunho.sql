create or replace function public.asaas_rate_limit_hit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean   -- true = permitido | false = estourou o limite
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.asaas_rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when public.asaas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then 1                                  -- janela expirou: reinicia
          else public.asaas_rate_limits.count + 1       -- mesma janela: +1
        end,
        window_start = case
          when public.asaas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
          else public.asaas_rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

grant execute on function public.asaas_rate_limit_hit(text, int, int) to service_role;