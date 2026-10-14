-- Marca manual de "pago recibido" (efectivo o transferencia) desde el panel.
alter table public.orders add column paid_at timestamptz;
comment on column public.orders.paid_at is 'Cuándo se marcó el pago como recibido (efectivo/transferencia: a mano desde el panel).';
