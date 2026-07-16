create table public.barbershop_gallery (
  id uuid not null default gen_random_uuid (),
  barbershop_id uuid not null,
  url text not null,
  "order" integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint barbershop_gallery_pkey primary key (id),
  constraint barbershop_gallery_barbershop_id_fkey foreign KEY (barbershop_id) references barbershops (id) on delete CASCADE
) TABLESPACE pg_default;