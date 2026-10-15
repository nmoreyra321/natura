-- La clienta avisa desde la tienda que ya transfirió (y puede subir el comprobante);
-- la administradora lo revisa y aprueba o rechaza el pago desde el panel.
alter table public.orders add column payment_reported_at timestamptz;
comment on column public.orders.payment_reported_at is
  'Cuándo la clienta avisó que transfirió. Mientras no se apruebe ni se rechace, el pago queda "por revisar".';
alter table public.orders add column payment_proof_path text
  check (payment_proof_path is null or char_length(payment_proof_path) <= 300);
comment on column public.orders.payment_proof_path is 'Comprobante que subió la clienta (bucket privado payment-proofs).';
alter table public.orders add column payment_rejection text
  check (payment_rejection is null or char_length(payment_rejection) <= 200);
comment on column public.orders.payment_rejection is 'Por qué no se aprobó el pago (lo ve la clienta en la página de su pedido).';

create index orders_payment_review_idx on public.orders (payment_reported_at)
  where payment_reported_at is not null;

-- Bucket privado: los comprobantes los sube el servidor (clave secreta) y solo los ven administradoras.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Administradoras ven comprobantes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));

create policy "Administradoras borran comprobantes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));
