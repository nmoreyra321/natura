-- El Club cuenta lo que compró en productos: el envío no suma al mínimo.
-- products_total = total del pedido sin el envío (se calcula solo).
alter table public.orders
  add column products_total numeric(12, 2) generated always as (total - shipping_cost) stored;

-- Las zonas de envío ahora se cobran por porcentaje: el precio fijo ya no se usa.
alter table public.shipping_zones alter column price set default 0;
