-- Club de clientas: cada 5 compras confirmadas (contadas por teléfono), un regalo.
-- Las compras se cuentan de la tabla orders; acá solo se anotan los regalos ya entregados.
create table public.loyalty_gifts (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^\d{8,15}$'),
  given_at timestamptz not null default now()
);
create index loyalty_gifts_phone_idx on public.loyalty_gifts (phone);
alter table public.loyalty_gifts enable row level security;
comment on table public.loyalty_gifts is 'Regalos del club de clientas ya entregados (uno por fila), por teléfono normalizado (549…).';

create policy "Administradoras ven los regalos"
  on public.loyalty_gifts for select
  to authenticated
  using ((select public.is_admin()));

create policy "Administradoras anotan regalos"
  on public.loyalty_gifts for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras deshacen regalos"
  on public.loyalty_gifts for delete
  to authenticated
  using ((select public.is_admin()));
