create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,70}$'),
  message text check (message is null or char_length(message) <= 200),
  starts_on date not null,
  ends_on date not null,
  product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (cardinality(product_ids) <= 200)
);
alter table public.campaigns enable row level security;
comment on table public.campaigns is 'Fechas especiales (Día de la Madre, del Padre...): cartel en la portada y página con productos elegidos mientras están activas.';

create policy "Público ve las fechas especiales activas"
  on public.campaigns for select
  to anon, authenticated
  using (
    ((now() at time zone 'America/Argentina/Buenos_Aires')::date between starts_on and ends_on)
    or (select public.is_admin())
  );

create policy "Administradoras crean fechas especiales"
  on public.campaigns for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras editan fechas especiales"
  on public.campaigns for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Administradoras borran fechas especiales"
  on public.campaigns for delete
  to authenticated
  using ((select public.is_admin()));

alter table public.orders add column is_gift boolean not null default false;
alter table public.orders add column gift_note text check (gift_note is null or char_length(gift_note) <= 200);
comment on column public.orders.is_gift is 'La clienta marcó «Es para regalo» en el carrito.';
comment on column public.orders.gift_note is 'Nota para el regalo (por ejemplo, para quién es o qué escribir en la tarjeta).';
