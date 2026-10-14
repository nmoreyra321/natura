-- Historial de facturas de Natura cargadas desde el panel (para no cargar la misma dos veces
-- y para ver qué llegó en cada una).
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  invoice_number text check (invoice_number is null or char_length(invoice_number) between 1 and 60),
  invoice_date date,
  due_date date,
  total numeric(14, 2) check (total is null or total >= 0),
  units integer not null default 0 check (units >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index receipts_invoice_number_key on public.receipts (invoice_number) where invoice_number is not null;
create index receipts_created_idx on public.receipts (created_at desc);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null check (char_length(product_name) between 1 and 200),
  description text check (description is null or char_length(description) <= 160),
  quantity integer not null check (quantity between 1 and 100000),
  created_at timestamptz not null default now()
);
create index receipt_items_receipt_idx on public.receipt_items (receipt_id);
create index receipt_items_product_idx on public.receipt_items (product_id);

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
create policy "Administradoras manejan facturas" on public.receipts
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Administradoras manejan renglones de facturas" on public.receipt_items
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
