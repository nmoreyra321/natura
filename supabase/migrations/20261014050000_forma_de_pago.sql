-- Forma de pago de cada pedido: efectivo (se arregla por WhatsApp) o Mercado Pago (pago online).
alter table public.orders
  add column payment_method text not null default 'efectivo'
    check (payment_method in ('efectivo', 'mercadopago')),
  -- Estado que informa Mercado Pago (null en efectivo).
  add column payment_status text
    check (payment_status in ('pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back')),
  add column mp_payment_id text;

comment on column public.orders.payment_method is 'efectivo | mercadopago';
comment on column public.orders.payment_status is 'Estado del pago en Mercado Pago; lo actualiza el servidor con la clave secreta.';
