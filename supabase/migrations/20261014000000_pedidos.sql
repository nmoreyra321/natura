-- =====================================================================
-- Pedidos: cada pedido enviado por WhatsApp queda registrado para el panel.
-- El público no lee ni modifica pedidos: solo los crea a través de create_order(),
-- que toma precios y nombres de la base (nunca del navegador).
-- =====================================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'delivered', 'cancelled')),
  customer_name text check (customer_name is null or char_length(customer_name) between 1 and 80),
  total numeric(12, 2) not null check (total >= 0),
  savings numeric(12, 2) not null default 0 check (savings >= 0),
  -- true cuando el stock ya se descontó (al confirmar o entregar).
  stock_applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  size text,
  quantity integer not null check (quantity between 1 and 1000),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  magazine_price numeric(12, 2) not null check (magazine_price >= 0)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Administradoras leen pedidos"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

create policy "Administradoras editan pedidos"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Administradoras eliminan pedidos"
  on public.orders for delete to authenticated
  using ((select public.is_admin()));

create policy "Administradoras leen ítems de pedidos"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Crear pedido (público). Valida productos publicados y usa los precios de la base.
-- items: [{"productId": "<uuid>", "quantity": 2}, ...]
-- ---------------------------------------------------------------------
create or replace function public.create_order(items jsonb, customer_name text default null)
returns table (id uuid, number bigint, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_number bigint;
  v_total numeric(12, 2) := 0;
  v_savings numeric(12, 2) := 0;
  v_count integer;
  v_lines jsonb;
  v_name text := nullif(btrim(left(coalesce(customer_name, ''), 80)), '');
begin
  if jsonb_typeof(items) <> 'array' then
    raise exception 'items inválidos' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(items);
  if v_count < 1 or v_count > 50 then
    raise exception 'cantidad de productos inválida' using errcode = '22023';
  end if;

  -- Freno simple contra envíos masivos automatizados.
  if (select count(*) from public.orders o where o.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'demasiados pedidos, probá en un minuto' using errcode = 'P0001';
  end if;

  -- Una línea por producto (si viene repetido, se suman las cantidades).
  select coalesce(jsonb_agg(jsonb_build_object('product_id', x.product_id, 'quantity', x.quantity)), '[]'::jsonb)
  into v_lines
  from (
    select (e->>'productId')::uuid as product_id, sum((e->>'quantity')::integer) as quantity
    from jsonb_array_elements(items) e
    group by 1
  ) x;

  if exists (
    select 1 from jsonb_to_recordset(v_lines) l(product_id uuid, quantity integer)
    where l.quantity is null or l.quantity < 1 or l.quantity > 1000
  ) then
    raise exception 'cantidad inválida' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(v_lines) l(product_id uuid, quantity integer)
    left join public.products p on p.id = l.product_id and p.status = 'published'
    where p.id is null
  ) then
    raise exception 'hay productos que ya no están disponibles' using errcode = 'P0002';
  end if;

  select
    coalesce(sum(p.sale_price * l.quantity), 0),
    coalesce(sum(greatest(p.magazine_price - p.sale_price, 0) * l.quantity), 0)
  into v_total, v_savings
  from jsonb_to_recordset(v_lines) l(product_id uuid, quantity integer)
  join public.products p on p.id = l.product_id;

  insert into public.orders (customer_name, total, savings)
  values (v_name, v_total, v_savings)
  returning orders.id, orders.number into v_order_id, v_number;

  insert into public.order_items (order_id, product_id, name, size, quantity, unit_price, magazine_price)
  select v_order_id, p.id, p.name, p.size, l.quantity, p.sale_price, p.magazine_price
  from jsonb_to_recordset(v_lines) l(product_id uuid, quantity integer)
  join public.products p on p.id = l.product_id;

  return query select v_order_id, v_number, v_total;
end;
$$;

revoke all on function public.create_order(jsonb, text) from public;
grant execute on function public.create_order(jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Cambiar estado (solo administradoras). Confirmar o entregar descuenta stock una vez;
-- cancelar un pedido que ya había descontado stock lo devuelve.
-- ---------------------------------------------------------------------
create or replace function public.set_order_status(order_id uuid, new_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_apply boolean;
begin
  if not (select public.is_admin()) then
    raise exception 'sin permisos' using errcode = '42501';
  end if;
  if new_status not in ('pending', 'confirmed', 'delivered', 'cancelled') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;

  select * into v_order from public.orders o where o.id = order_id for update;
  if not found then
    raise exception 'pedido inexistente' using errcode = 'P0002';
  end if;

  v_apply := new_status in ('confirmed', 'delivered');

  if v_apply and not v_order.stock_applied then
    update public.products p
    set stock = greatest(p.stock - i.quantity, 0)
    from public.order_items i
    where i.order_id = v_order.id and i.product_id = p.id;
  elsif not v_apply and v_order.stock_applied then
    update public.products p
    set stock = least(p.stock + i.quantity, 100000)
    from public.order_items i
    where i.order_id = v_order.id and i.product_id = p.id;
  end if;

  update public.orders o
  set status = new_status, stock_applied = v_apply
  where o.id = v_order.id;
end;
$$;

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;
