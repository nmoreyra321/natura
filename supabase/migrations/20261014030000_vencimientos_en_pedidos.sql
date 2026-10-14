-- Al confirmar o entregar un pedido se descuentan unidades de los lotes, empezando por el
-- que vence primero. Se guarda de qué vencimiento salió cada unidad para poder devolverla
-- al mismo lote si el pedido se cancela o vuelve a pendiente.

-- Un lote por producto y vencimiento (la carga ya suma unidades si se repite).
alter table public.product_lots
  add constraint product_lots_product_expiry_key unique (product_id, expires_on);

create table public.order_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  expires_on date not null,
  quantity integer not null check (quantity between 1 and 10000)
);

create index order_lot_allocations_order_idx on public.order_lot_allocations (order_id);

alter table public.order_lot_allocations enable row level security;

create policy "Administradoras leen asignaciones de lotes"
  on public.order_lot_allocations for select to authenticated
  using ((select public.is_admin()));

create policy "Administradoras crean asignaciones de lotes"
  on public.order_lot_allocations for insert to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras eliminan asignaciones de lotes"
  on public.order_lot_allocations for delete to authenticated
  using ((select public.is_admin()));
