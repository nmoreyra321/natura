create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
comment on table public.push_subscriptions is 'Celulares de las administradoras que reciben avisos de pedidos nuevos.';

create policy "Administradoras ven sus avisos"
  on public.push_subscriptions for select
  to authenticated
  using ((select public.is_admin()));

create policy "Administradoras activan avisos"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras actualizan avisos"
  on public.push_subscriptions for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Administradoras desactivan avisos"
  on public.push_subscriptions for delete
  to authenticated
  using ((select public.is_admin()));
