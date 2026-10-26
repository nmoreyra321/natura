-- Un producto sin precio (provisorio de $1, queda como borrador) no puede recibir stock ni publicarse hasta que tenga su precio.
create or replace function public.require_price_for_stock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.magazine_price > 1 then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.stock > 0)
     or (tg_op = 'UPDATE' and new.stock > old.stock)
     or (tg_op = 'UPDATE' and new.status = 'published' and old.status <> 'published') then
    raise exception 'Primero poné el precio de revista de este producto.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists products_require_price_for_stock on public.products;
create trigger products_require_price_for_stock
  before insert or update of stock, status, magazine_price on public.products
  for each row execute function public.require_price_for_stock();
