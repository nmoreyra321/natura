-- Código del producto en naturacosmeticos.com.ar (por ejemplo NATARG-2821).
-- Permite volver a consultar el precio de revista vigente desde el panel.
alter table public.products
  add column natura_sku text unique
    check (natura_sku is null or natura_sku ~ '^NATARG-[0-9]{1,12}$');
