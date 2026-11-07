alter table public.store_settings
  add column if not exists ml_costs jsonb not null default '{}'::jsonb;
comment on column public.store_settings.ml_costs is 'Costos de Mercado Libre guardados para la planilla: comisión, costo fijo por tramos y envío gratis ({} = valores de referencia).';
