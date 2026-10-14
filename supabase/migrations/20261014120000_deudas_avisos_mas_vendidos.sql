-- Teléfono de la clienta (opcional) para recordatorios por WhatsApp.
alter table public.orders add column customer_phone text
  check (customer_phone is null or customer_phone ~ '^\d{8,15}$');

-- "Avisame cuando vuelva": la clienta deja su WhatsApp en un producto sin stock.
create table public.restock_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text check (name is null or char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^\d{8,15}$'),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index restock_requests_product_idx on public.restock_requests (product_id) where notified_at is null;
create unique index restock_requests_unique_pending on public.restock_requests (product_id, phone) where notified_at is null;

alter table public.restock_requests enable row level security;
-- Cualquiera puede anotarse (solo productos publicados); nadie de afuera puede leer la lista.
create policy "Clientas se anotan para el aviso" on public.restock_requests
  for insert to anon, authenticated
  with check (
    notified_at is null
    and exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
  );
create policy "Administradoras leen avisos" on public.restock_requests
  for select to authenticated using ((select public.is_admin()));
create policy "Administradoras editan avisos" on public.restock_requests
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Administradoras borran avisos" on public.restock_requests
  for delete to authenticated using ((select public.is_admin()));

-- Más vendidos de los últimos 90 días (solo productos publicados). Devuelve solo ids y unidades.
create or replace function public.best_sellers(max_items integer default 8)
returns table (product_id uuid, units bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select i.product_id, sum(i.quantity)::bigint as units
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  where o.status in ('confirmed', 'delivered')
    and o.created_at > now() - interval '90 days'
    and p.status = 'published'
  group by i.product_id
  order by units desc
  limit least(greatest(coalesce(max_items, 8), 1), 24);
$$;
revoke all on function public.best_sellers(integer) from public;
grant execute on function public.best_sellers(integer) to anon, authenticated;
