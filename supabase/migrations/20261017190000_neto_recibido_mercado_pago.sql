-- Cuánta plata le llega de verdad a la vendedora en un pago de Mercado Pago (después de la comisión).
-- Sirve para avisar si Mercado Pago cobra más de lo que cubre el recargo.
alter table public.orders add column if not exists mp_net_received numeric(12, 2);
comment on column public.orders.mp_net_received is 'Monto neto que recibió la vendedora por el pago de Mercado Pago (descontada la comisión).';
