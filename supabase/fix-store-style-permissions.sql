-- Fix permissions for the public.store_style table.
--
-- Symptom:
--   GET /rest/v1/store_style returns 403 with:
--   "permission denied for table store_style"
--
-- Cause:
--   RLS policies exist, but anon/authenticated do not have table-level
--   SELECT/INSERT/UPDATE grants. PostgreSQL checks table privileges before
--   applying RLS policies.

grant select on table public.store_style to anon, authenticated;
grant insert, update on table public.store_style to authenticated;

drop policy if exists "store_style_insert_owner" on public.store_style;

create policy "store_style_insert_owner"
on public.store_style
for insert
to authenticated
with check (
  barbershop_id in (
    select id
    from public.barbershops
    where owner_id = auth.uid()
  )
);

drop policy if exists "store_style_update_owner" on public.store_style;

create policy "store_style_update_owner"
on public.store_style
for update
to authenticated
using (
  barbershop_id in (
    select id
    from public.barbershops
    where owner_id = auth.uid()
  )
)
with check (
  barbershop_id in (
    select id
    from public.barbershops
    where owner_id = auth.uid()
  )
);
