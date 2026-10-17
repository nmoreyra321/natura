-- Confirmación automática de pedidos pagados con Mercado Pago.
-- Hace lo mismo que set_order_status al confirmar (descuenta stock y vencimientos), pero sin pedir
-- sesión de administradora: solo la puede llamar el servidor de la tienda (service_role).
create or replace function public.apply_stock_take(p_order uuid) returns void language plpgsql set search_path = '' as $$
declare v_item record; v_lot record; v_stock integer; v_left integer; v_take integer;
begin
  for v_item in select i.id, i.product_id, i.quantity from public.order_items i where i.order_id = p_order and i.product_id is not null loop
    select p.stock into v_stock from public.products p where p.id = v_item.product_id for update;
    v_take := least(v_item.quantity, greatest(coalesce(v_stock, 0), 0));
    update public.products p set stock = p.stock - v_take where p.id = v_item.product_id;
    update public.order_items i set stock_taken = v_take where i.id = v_item.id;
    v_left := v_item.quantity;
    for v_lot in select l.id, l.expires_on, l.quantity from public.product_lots l where l.product_id = v_item.product_id order by (l.expires_on < current_date), l.expires_on, l.created_at for update loop
      exit when v_left <= 0;
      v_take := least(v_left, v_lot.quantity);
      if v_take = v_lot.quantity then delete from public.product_lots l where l.id = v_lot.id;
      else update public.product_lots l set quantity = l.quantity - v_take where l.id = v_lot.id; end if;
      insert into public.order_lot_allocations (order_id, product_id, expires_on, quantity) values (p_order, v_item.product_id, v_lot.expires_on, v_take);
      v_left := v_left - v_take;
    end loop;
  end loop;
end; $$;

create or replace function public.apply_order_status(order_id uuid, new_status text) returns void language plpgsql set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  if new_status not in ('confirmed', 'delivered') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  select * into v_order from public.orders o where o.id = order_id for update;
  if not found then
    raise exception 'pedido inexistente' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    return;
  end if;
  if not v_order.stock_applied then
    perform public.apply_stock_take(v_order.id);
  end if;
  update public.orders o set status = new_status, stock_applied = true where o.id = v_order.id;
end; $$;

revoke all on function public.apply_stock_take(uuid) from public, anon, authenticated;
revoke all on function public.apply_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_stock_take(uuid) to service_role;
grant execute on function public.apply_order_status(uuid, text) to service_role;
