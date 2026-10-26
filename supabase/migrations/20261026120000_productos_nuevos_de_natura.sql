-- Códigos de Natura que ya se revisaron al buscar productos nuevos, para no volver a mirar los mismos.
-- status: agregado (se creó el producto), variante (es otro tono/tamaño de un producto que ya existe),
-- sin_precio (la ficha no tiene precio), no_disponible (la ficha ya no existe).
create table public.natura_skus_vistos (
  sku text primary key check (sku ~ '^NATARG-[0-9]{1,12}$'),
  status text not null check (status in ('agregado', 'variante', 'sin_precio', 'no_disponible')),
  product_id uuid references public.products(id) on delete set null,
  name text check (name is null or char_length(name) <= 200),
  seen_at timestamptz not null default now()
);

alter table public.natura_skus_vistos enable row level security;
create policy "Administradoras manejan los códigos vistos" on public.natura_skus_vistos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
