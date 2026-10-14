-- Código público del pedido: al azar, para no mostrar el número correlativo (que revela cuántas ventas hay).
alter table public.orders
  add column code text not null default ('NM-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)));
alter table public.orders add constraint orders_code_key unique (code);
comment on column public.orders.code is 'Código público del pedido (al azar, no revela cuántas ventas hay).';
