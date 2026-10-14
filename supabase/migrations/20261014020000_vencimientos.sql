-- Vencimientos por lote: un mismo producto puede tener unidades que vencen en meses distintos.
-- expires_on es el último día del mes impreso en el envase (ej. "01/29" → 2029-01-31).
create table public.product_lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  expires_on date not null,
  quantity integer not null check (quantity between 1 and 10000),
  created_at timestamptz not null default now()
);

create index product_lots_expires_idx on public.product_lots (expires_on);
create index product_lots_product_idx on public.product_lots (product_id);

alter table public.product_lots enable row level security;

create policy "Administradoras leen lotes"
  on public.product_lots for select to authenticated
  using ((select public.is_admin()));

create policy "Administradoras crean lotes"
  on public.product_lots for insert to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras editan lotes"
  on public.product_lots for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Administradoras eliminan lotes"
  on public.product_lots for delete to authenticated
  using ((select public.is_admin()));
