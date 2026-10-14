-- Dónde se hizo cada venta: la tienda o cargada a mano (vivo de Facebook, en persona, etc.).
alter table public.orders add column channel text not null default 'web'
  check (channel in ('web', 'facebook', 'presencial', 'whatsapp', 'otro'));
comment on column public.orders.channel is 'Dónde se hizo la venta: web (la tienda) o cargada a mano desde el panel (vivo de Facebook, en persona, WhatsApp, otro).';
