-- Envíos a domicilio: solo a estas localidades (ramal Roca a Alejandro Korn, más Monte Grande).
-- Cada una con su precio, que Natu Mariel cambia desde Configuración. Los precios iniciales
-- son de ejemplo, por cercanía a Glew (de donde salen los envíos).
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(12, 2) not null check (price >= 0),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shipping_zones_set_updated_at
  before update on public.shipping_zones
  for each row execute function public.set_updated_at();

alter table public.shipping_zones enable row level security;

create policy "Público lee zonas de envío activas"
  on public.shipping_zones for select
  to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "Administradoras editan zonas de envío"
  on public.shipping_zones for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.shipping_zones to anon, authenticated;
grant update on public.shipping_zones to authenticated;

insert into public.shipping_zones (name, price, position) values
  ('Glew', 2000, 10),
  ('Longchamps', 2000, 20),
  ('Guernica', 2000, 30),
  ('Burzaco', 3000, 40),
  ('Alejandro Korn', 3000, 50),
  ('Adrogué', 3000, 60),
  ('Temperley', 4000, 70),
  ('Monte Grande', 4000, 80),
  ('Lomas de Zamora', 4000, 90),
  ('Banfield', 5000, 100),
  ('Remedios de Escalada', 5000, 110),
  ('Lanús', 5000, 120);

-- Cómo recibe cada pedido: punto de encuentro (gratis) o envío a domicilio.
-- shipping_cost guarda el costo del envío, que además se suma al total del pedido (así pagos y deudas lo cuentan).
alter table public.orders
  add column delivery_method text not null default 'retiro' check (delivery_method in ('retiro', 'envio')),
  add column shipping_zone text,
  add column shipping_address text,
  add column shipping_cost numeric(12, 2) not null default 0 check (shipping_cost >= 0);

-- Los visitantes solo leen (las reglas de acceso ya lo impedían; esto es una segunda barrera).
revoke insert, update, delete, truncate on public.shipping_zones from anon;
