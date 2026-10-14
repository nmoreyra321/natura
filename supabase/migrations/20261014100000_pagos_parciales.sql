-- Pagos en partes (seña y resto) y una nota del cobro, para efectivo y transferencia.
alter table public.orders add column amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0);
comment on column public.orders.amount_paid is 'Cuánto pagó la clienta hasta ahora (efectivo/transferencia; permite pagos en partes).';
alter table public.orders add column payment_note text check (payment_note is null or char_length(payment_note) <= 120);
comment on column public.orders.payment_note is 'Nota del cobro (ej.: "el resto el lunes").';
