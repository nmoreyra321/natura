-- =====================================================================
-- Natu Mariel — esquema inicial
-- Catálogo (categorías, productos, fotos), administradoras, RLS y storage.
-- No se cargan productos: el catálogo arranca vacío a propósito.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Administradoras
-- Solo se agregan filas desde el servidor con la service role key
-- (scripts/create-admin.mjs) o desde el SQL Editor de Supabase.
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "Cada administradora ve su propio registro"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Sin políticas de insert/update/delete: ningún cliente puede autoasignarse permisos.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text check (description is null or char_length(description) <= 300),
  position integer not null default 0 check (position between 0 and 1000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "Público lee categorías visibles"
  on public.categories for select
  to anon, authenticated
  using (is_visible or (select public.is_admin()));

create policy "Administradoras crean categorías"
  on public.categories for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras editan categorías"
  on public.categories for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Administradoras eliminan categorías"
  on public.categories for delete
  to authenticated
  using ((select public.is_admin()));

-- Categorías base de la tienda (estructura, no productos).
-- En la tienda pública solo se muestran si tienen productos publicados.
insert into public.categories (name, slug, position) values
  ('Perfumería', 'perfumeria', 10),
  ('Cuerpo y baño', 'cuerpo-y-bano', 20),
  ('Rostro', 'rostro', 30),
  ('Cabello', 'cabello', 40),
  ('Maquillaje', 'maquillaje', 50),
  ('Kits y regalos', 'kits', 60);

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  description text not null default '' check (char_length(description) <= 5000),
  category_id uuid references public.categories (id) on delete set null,
  size text check (size is null or char_length(size) <= 60),
  magazine_price numeric(12, 2) not null check (magazine_price > 0 and magazine_price <= 100000000),
  sale_price numeric(12, 2) not null check (sale_price > 0 and sale_price <= 100000000),
  stock integer not null default 0 check (stock between 0 and 100000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_featured boolean not null default false,
  is_offer boolean not null default false,
  -- Porcentaje de descuento real, calculado por la base (para ordenar y filtrar).
  discount_percent numeric(5, 2) generated always as (
    case
      when sale_price < magazine_price
        then round((magazine_price - sale_price) / magazine_price * 100, 2)
      else 0
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una oferta tiene que tener un descuento real frente al precio de revista.
  constraint products_offer_requires_discount check (not is_offer or sale_price < magazine_price)
);

create index products_status_idx on public.products (status);
create index products_category_idx on public.products (category_id);
create index products_created_at_idx on public.products (created_at desc);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "Público lee productos publicados"
  on public.products for select
  to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

create policy "Administradoras crean productos"
  on public.products for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras editan productos"
  on public.products for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Administradoras eliminan productos"
  on public.products for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Fotos de productos (los archivos viven en Supabase Storage)
-- ---------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique
    check (storage_path ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif)$'),
  alt text check (alt is null or char_length(alt) <= 200),
  position integer not null default 0 check (position between 0 and 100),
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, position);

alter table public.product_images enable row level security;

create policy "Público lee fotos de productos publicados"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
    or (select public.is_admin())
  );

create policy "Administradoras agregan fotos"
  on public.product_images for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras editan fotos"
  on public.product_images for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Administradoras eliminan fotos"
  on public.product_images for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Storage: bucket público de lectura para las fotos del catálogo.
-- Solo administradoras pueden subir, reemplazar o borrar archivos.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Administradoras listan fotos del catálogo"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Administradoras suben fotos del catálogo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Administradoras reemplazan fotos del catálogo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Administradoras borran fotos del catálogo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
