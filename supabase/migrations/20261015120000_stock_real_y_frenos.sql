-- 1) Stock: al confirmar se anota cuánto se descontó de verdad de cada producto, y al cancelar
--    se devuelve solo eso. Antes, si se vendía más de lo que había (el stock quedaba en 0),
--    al cancelar se devolvía la cantidad entera y aparecía stock que no existía.
-- 2) Vencimientos: se descuentan primero los lotes que todavía no vencieron.
-- 3) Frenos contra abusos: los pedidos solo se crean desde el servidor de la tienda
--    (no directo con la clave pública), y hay un contador de intentos por persona.

alter table public.order_items add column stock_taken integer check (stock_taken is null or stock_taken >= 0);
comment on column public.order_items.stock_taken is
  'Unidades que se descontaron del stock al confirmar (puede ser menos que quantity si no alcanzaba). null = no descontado.';

-- Pedidos que ya descontaron stock: se asume que se descontó todo (como funcionaba hasta ahora).
update public.order_items i set stock_taken = i.quantity
from public.orders o
where o.id = i.order_id and o.stock_applied and i.product_id is not null;

create or replace function public.set_order_status(order_id uuid, new_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_apply boolean;
  v_item record;
  v_lot record;
  v_stock integer;
  v_left integer;
  v_take integer;
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
    for v_item in
      select i.id, i.product_id, i.quantity
      from public.order_items i
      where i.order_id = v_order.id and i.product_id is not null
    loop
      -- Stock: se descuenta lo que hay (nunca queda negativo) y se anota cuánto fue.
      select p.stock into v_stock from public.products p where p.id = v_item.product_id for update;
      v_take := least(v_item.quantity, greatest(coalesce(v_stock, 0), 0));
      update public.products p set stock = p.stock - v_take where p.id = v_item.product_id;
      update public.order_items i set stock_taken = v_take where i.id = v_item.id;

      -- Vencimientos: primero los que no vencieron (el que vence antes), después los vencidos.
      v_left := v_item.quantity;
      for v_lot in
        select l.id, l.expires_on, l.quantity
        from public.product_lots l
        where l.product_id = v_item.product_id
        order by (l.expires_on < current_date), l.expires_on, l.created_at
        for update
      loop
        exit when v_left <= 0;
        v_take := least(v_left, v_lot.quantity);
        if v_take = v_lot.quantity then
          delete from public.product_lots l where l.id = v_lot.id;
        else
          update public.product_lots l set quantity = l.quantity - v_take where l.id = v_lot.id;
        end if;
        insert into public.order_lot_allocations (order_id, product_id, expires_on, quantity)
        values (v_order.id, v_item.product_id, v_lot.expires_on, v_take);
        v_left := v_left - v_take;
      end loop;
    end loop;

  elsif not v_apply and v_order.stock_applied then
    -- Se devuelve solo lo que se había descontado.
    update public.products p
    set stock = least(p.stock + coalesce(i.stock_taken, i.quantity), 100000)
    from public.order_items i
    where i.order_id = v_order.id and i.product_id = p.id;
    update public.order_items i set stock_taken = null where i.order_id = v_order.id;

    -- Devuelve cada unidad a su vencimiento (recrea el lote si ya no existía).
    insert into public.product_lots (product_id, expires_on, quantity)
    select a.product_id, a.expires_on, least(sum(a.quantity), 10000)::integer
    from public.order_lot_allocations a
    where a.order_id = v_order.id
    group by a.product_id, a.expires_on
    on conflict (product_id, expires_on)
    do update set quantity = least(public.product_lots.quantity + excluded.quantity, 10000);

    delete from public.order_lot_allocations a where a.order_id = v_order.id;
  end if;

  update public.orders o
  set status = new_status, stock_applied = v_apply
  where o.id = v_order.id;
end;
$$;

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;

-- Crear pedido: igual que antes, pero sin aceptar más unidades que el stock.
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
  v_short text;
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

  -- Stock: no se aceptan más unidades de las que hay (la tienda tampoco deja agregarlas).
  perform 1
  from public.products p
  join jsonb_to_recordset(v_lines) l(product_id uuid, quantity integer) on l.product_id = p.id
  for update of p;
  select p.name into v_short
  from jsonb_to_recordset(v_lines) l(product_id uuid, quantity integer)
  join public.products p on p.id = l.product_id
  where l.quantity > p.stock
  limit 1;
  if v_short is not null then
    raise exception 'sin stock suficiente: %', v_short using errcode = 'P0001';
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

-- Los pedidos se crean solo desde el servidor de la tienda (que exige nombre y WhatsApp).
revoke execute on function public.create_order(jsonb, text) from anon, authenticated;
grant execute on function public.create_order(jsonb, text) to service_role;

-- «Avisame cuando vuelva»: también solo desde el servidor (con freno de intentos).
drop policy if exists "Clientas se anotan para el aviso" on public.restock_requests;

-- Contador de intentos por persona (ventana de tiempo). Solo lo usa el servidor.
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
comment on table public.rate_limits is 'Intentos por persona y acción (para frenar abusos). Sin acceso público.';

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_seconds) * p_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_max;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
