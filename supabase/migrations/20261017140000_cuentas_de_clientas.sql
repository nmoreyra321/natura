-- Cuentas de clientas (entran con Google o Facebook). El Club cuenta solo los pedidos hechos
-- con la cuenta, agrupados por el WhatsApp de la cuenta. Comprar sin cuenta sigue funcionando.
create table public.customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text check (name is null or char_length(name) <= 80),
  phone text check (phone is null or char_length(phone) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

-- Cada clienta ve y edita solo su propia cuenta; las administradoras ven todas.
create policy "Clienta ve su cuenta"
  on public.customers for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Clienta crea su cuenta"
  on public.customers for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Clienta edita su cuenta"
  on public.customers for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.customers from anon;
grant select, insert, update on public.customers to authenticated;

-- Pedido hecho con la cuenta (null = sin cuenta, no suma al Club).
alter table public.orders
  add column customer_user_id uuid references auth.users (id) on delete set null;
create index orders_customer_user_id_idx on public.orders (customer_user_id);
