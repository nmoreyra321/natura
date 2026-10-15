-- Reseñas de clientas: nombre, estrellas (1 a 5) y comentario opcional. Una por pedido.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.orders (id) on delete set null,
  name text not null check (char_length(name) between 2 and 60),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index reviews_created_at_idx on public.reviews (created_at desc);
alter table public.reviews enable row level security;

-- Cualquiera puede leerlas (se muestran en la tienda). Se cargan desde el servidor.
create policy "Público lee las reseñas" on public.reviews for select to anon, authenticated using (true);
-- Solo las administradoras pueden sacarlas.
create policy "Administradoras borran reseñas" on public.reviews for delete to authenticated using ((select public.is_admin()));
