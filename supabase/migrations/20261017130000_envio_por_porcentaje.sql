-- El envío pasa a ser un % de la compra (según la localidad) y solo desde un monto mínimo.
-- Los % iniciales son de ejemplo, por cercanía a Glew; se cambian desde Configuración.
-- (La columna price queda sin uso. Los % se cargan con "using" en vez de un update.)
alter table public.shipping_zones
  add column percent numeric(5, 2) not null default 0 check (percent >= 0 and percent <= 100);

alter table public.shipping_zones alter column percent drop default;
alter table public.shipping_zones alter column percent type numeric(5, 2) using (case
  when name in ('Glew', 'Longchamps', 'Guernica') then 5
  when name in ('Burzaco', 'Alejandro Korn', 'Adrogué') then 7
  when name in ('Temperley', 'Monte Grande', 'Lomas de Zamora') then 9
  else 11
end);
alter table public.shipping_zones alter column percent set default 0;

alter table public.store_settings
  add column shipping_min_total numeric(12, 2) not null default 35000 check (shipping_min_total >= 0);
