-- Cada categoría puede guardar su descuento (ej.: perfumes 20 %). Los productos nuevos de esa categoría,
-- o los que cambian de precio de revista, quedan con ese descuento solos.
alter table public.categories
  add column if not exists discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent < 100),
  add column if not exists discount_offer boolean not null default true;

comment on column public.categories.discount_percent is
  'Descuento (%) sobre el precio de revista que se aplica solo a los productos de la categoría. 0 = sin descuento.';
comment on column public.categories.discount_offer is
  'Si es true, los productos con ese descuento también aparecen en Ofertas.';

create or replace function public.apply_category_discount()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_percent numeric;
  v_offer boolean;
  v_price numeric;
begin
  if new.category_id is null then
    return new;
  end if;
  -- Al editar: solo si cambió el precio de revista o la categoría (así no pisa un precio puesto a mano).
  if tg_op = 'UPDATE'
     and new.magazine_price is not distinct from old.magazine_price
     and new.category_id is not distinct from old.category_id then
    return new;
  end if;
  -- Al crear: solo si el producto no trae un descuento propio.
  if tg_op = 'INSERT' and new.sale_price < new.magazine_price then
    return new;
  end if;

  select c.discount_percent, c.discount_offer into v_percent, v_offer
  from public.categories c where c.id = new.category_id;
  if coalesce(v_percent, 0) <= 0 then
    return new;
  end if;

  v_price := greatest(floor(new.magazine_price * (100 - v_percent) / 100), 1);
  if v_price < new.magazine_price then
    new.sale_price := v_price;
    if v_offer then
      new.is_offer := true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_apply_category_discount on public.products;
create trigger products_apply_category_discount
  before insert or update of magazine_price, category_id on public.products
  for each row execute function public.apply_category_discount();
