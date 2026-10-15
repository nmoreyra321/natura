-- Natu Mariel: arreglos A y B (pegar todo en Supabase → SQL Editor → Run).
-- A) Al cancelar un pedido se devuelve solo el stock que se había descontado de verdad.
-- B) «Avisame cuando vuelva» solo se puede anotar desde la tienda.

create or replace function public.set_order_status(order_id uuid, new_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as '
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
    raise exception ''sin permisos'' using errcode = ''42501'';
  end if;
  if new_status not in (''pending'', ''confirmed'', ''delivered'', ''cancelled'') then
    raise exception ''estado inválido'' using errcode = ''22023'';
  end if;

  select * into v_order from public.orders o where o.id = order_id for update;
  if not found then
    raise exception ''pedido inexistente'' using errcode = ''P0002'';
  end if;

  v_apply := new_status in (''confirmed'', ''delivered'');

  if v_apply and not v_order.stock_applied then
    for v_item in
      select i.id, i.product_id, i.quantity
      from public.order_items i
      where i.order_id = v_order.id and i.product_id is not null
    loop
      select p.stock into v_stock from public.products p where p.id = v_item.product_id for update;
      v_take := least(v_item.quantity, greatest(coalesce(v_stock, 0), 0));
      update public.products p set stock = p.stock - v_take where p.id = v_item.product_id;
      update public.order_items i set stock_taken = v_take where i.id = v_item.id;

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
    update public.products p
    set stock = least(p.stock + coalesce(i.stock_taken, i.quantity), 100000)
    from public.order_items i
    where i.order_id = v_order.id and i.product_id = p.id;
    update public.order_items i set stock_taken = null where i.order_id = v_order.id;

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
';

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;

drop policy if exists "Clientas se anotan para el aviso" on public.restock_requests;
