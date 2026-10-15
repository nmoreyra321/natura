alter table public.orders add column customer_cancelled_at timestamptz;
comment on column public.orders.customer_cancelled_at is 'Cuándo la clienta canceló el pedido desde la página (el pedido no se borra; queda cancelado en el panel).';
