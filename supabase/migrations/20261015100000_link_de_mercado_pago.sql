-- Link de pago de Mercado Pago (sin monto fijo): la clienta lo abre desde la página de su pedido,
-- escribe el monto y paga. Después avisa en la tienda y la administradora aprueba el pago.
alter table public.store_settings add column mp_link text
  check (mp_link is null or (char_length(mp_link) <= 200 and mp_link ~ '^https://(link\.mercadopago\.com\.ar|mpago\.la|mpago\.li)/'));
comment on column public.store_settings.mp_link is 'Link de pago de Mercado Pago sin monto fijo (ej.: https://link.mercadopago.com.ar/natumariel).';

update public.store_settings set mp_link = 'https://link.mercadopago.com.ar/natumariel' where id = 1;
