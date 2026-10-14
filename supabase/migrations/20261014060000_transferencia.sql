-- Pago por transferencia (sin comisión): datos de la cuenta que se muestran en el carrito.
alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('efectivo', 'transferencia', 'mercadopago'));

-- Configuración de la tienda: una sola fila (id = 1).
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  transfer_alias text check (transfer_alias is null or char_length(transfer_alias) between 6 and 40),
  transfer_cbu text check (transfer_cbu is null or transfer_cbu ~ '^\d{22}$'),
  transfer_holder text check (transfer_holder is null or char_length(transfer_holder) between 2 and 80),
  transfer_bank text check (transfer_bank is null or char_length(transfer_bank) between 2 and 40),
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

alter table public.store_settings enable row level security;
-- Los datos para transferir se muestran a las clientas: lectura pública.
create policy "Lectura pública de la configuración" on public.store_settings
  for select to anon, authenticated using (true);
create policy "Solo admin edita la configuración" on public.store_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
