-- Reservas de 24 horas: la clienta separa un producto y la tienda lo guarda un día.
-- Al reservar se descuenta del stock (así nadie más lo compra); si vence o se cancela, la cantidad vuelve.
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10),
  name text not null check (char_length(name) between 2 and 60),
  phone text not null check (char_length(phone) between 6 and 20),
  status text not null default 'active' check (status in ('active', 'picked_up', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  closed_at timestamptz
);
create index reservations_active_idx on public.reservations (status, expires_at);
create index reservations_product_idx on public.reservations (product_id);
alter table public.reservations enable row level security;
create policy "Administradoras ven las reservas" on public.reservations for select to authenticated using ((select public.is_admin()));
create policy "Administradoras actualizan las reservas" on public.reservations for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Devuelve al stock las reservas vencidas. Solo la usa el servidor de la tienda.
create function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select r.id, r.product_id, r.quantity
    from public.reservations r
    where r.status = 'active' and r.expires_at <= now()
    order by r.created_at
    for update
  loop
    update public.products p set stock = p.stock + v_row.quantity where p.id = v_row.product_id;
    update public.reservations r set status = 'expired', closed_at = now() where r.id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.release_expired_reservations() from public, anon, authenticated;
grant execute on function public.release_expired_reservations() to service_role;

-- Reserva un producto: revisa el stock, lo descuenta y anota la reserva. Solo la usa el servidor de la tienda.
create function public.reserve_product(p_product uuid, p_quantity integer, p_name text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
  v_name text;
  v_active integer;
  v_id uuid;
begin
  perform public.release_expired_reservations();

  select p.stock, p.name into v_stock, v_name
  from public.products p
  where p.id = p_product and p.status = 'published'
  for update;
  if not found then
    raise exception 'producto no disponible' using errcode = 'P0002';
  end if;
  if p_quantity < 1 or p_quantity > 10 then
    raise exception 'cantidad inválida' using errcode = '22023';
  end if;
  if v_stock < p_quantity then
    raise exception 'sin stock suficiente: %', v_name using errcode = 'P0001';
  end if;

  select count(*) into v_active from public.reservations r where r.phone = p_phone and r.status = 'active';
  if v_active >= 3 then
    raise exception 'demasiadas reservas activas' using errcode = 'P0001';
  end if;

  update public.products p set stock = p.stock - p_quantity where p.id = p_product;
  insert into public.reservations (product_id, quantity, name, phone)
  values (p_product, p_quantity, p_name, p_phone)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.reserve_product(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.reserve_product(uuid, integer, text, text) to service_role;

-- La administradora cierra una reserva: cancelada (el stock vuelve) o retirada (el stock ya estaba descontado).
create function public.close_reservation(p_id uuid, p_release boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.reservations%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception 'sin permisos' using errcode = '42501';
  end if;
  select * into v_row from public.reservations r where r.id = p_id for update;
  if not found or v_row.status <> 'active' then
    raise exception 'reserva inexistente o ya cerrada' using errcode = 'P0002';
  end if;
  if p_release then
    update public.products p set stock = p.stock + v_row.quantity where p.id = v_row.product_id;
  end if;
  update public.reservations r
  set status = case when p_release then 'cancelled' else 'picked_up' end, closed_at = now()
  where r.id = p_id;
end;
$$;
