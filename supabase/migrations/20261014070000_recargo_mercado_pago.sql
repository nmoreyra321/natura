-- Recargo opcional que paga la clienta cuando elige Mercado Pago (cubre la comisión).
alter table public.store_settings
  add column mp_surcharge_percent numeric(4, 2) not null default 0
    check (mp_surcharge_percent >= 0 and mp_surcharge_percent <= 25);
comment on column public.store_settings.mp_surcharge_percent is 'Recargo que paga la clienta si elige Mercado Pago (para cubrir la comisión).';
