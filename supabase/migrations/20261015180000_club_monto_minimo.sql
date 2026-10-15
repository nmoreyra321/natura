alter table public.store_settings add column loyalty_min_total numeric(12, 2) not null default 20000 check (loyalty_min_total >= 0 and loyalty_min_total <= 10000000);
comment on column public.store_settings.loyalty_min_total is 'Club de clientas: monto mínimo del pedido para que sume una compra.';
