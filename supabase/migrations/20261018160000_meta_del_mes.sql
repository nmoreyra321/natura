alter table public.store_settings
  add column if not exists monthly_goal numeric(12, 2) not null default 0
    check (monthly_goal >= 0 and monthly_goal <= 100000000);
comment on column public.store_settings.monthly_goal is 'Meta de ventas del mes que se muestra en el Inicio del panel (0 = sin meta).';
