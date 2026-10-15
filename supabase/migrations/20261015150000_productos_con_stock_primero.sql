alter table public.products add column in_stock boolean generated always as (stock > 0) stored;
comment on column public.products.in_stock is 'true si hay stock (automático). Sirve para mostrar primero en la tienda lo que se puede comprar.';
create index products_published_in_stock_idx on public.products (status, in_stock);
