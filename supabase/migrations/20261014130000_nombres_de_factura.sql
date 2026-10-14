-- Lo que la página "aprende" de las facturas de Natura: cada descripción abreviada
-- (por ejemplo "TDIA SPRAY DES PERF FRUVER 200ML") queda unida al producto de la tienda
-- que la administradora confirmó. La próxima factura la reconoce sola.
create table public.receipt_aliases (
  description text primary key check (char_length(description) between 1 and 160),
  product_id uuid not null references public.products(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index receipt_aliases_product_idx on public.receipt_aliases (product_id);

alter table public.receipt_aliases enable row level security;
create policy "Administradoras leen nombres de factura" on public.receipt_aliases
  for select to authenticated using ((select public.is_admin()));
create policy "Administradoras cargan nombres de factura" on public.receipt_aliases
  for insert to authenticated with check ((select public.is_admin()));
create policy "Administradoras editan nombres de factura" on public.receipt_aliases
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Administradoras borran nombres de factura" on public.receipt_aliases
  for delete to authenticated using ((select public.is_admin()));
