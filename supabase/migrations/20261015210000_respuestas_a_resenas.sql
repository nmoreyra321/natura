-- Natu Mariel puede contestar cada reseña; la respuesta se muestra en la tienda.
alter table public.reviews
  add column reply text check (reply is null or char_length(reply) <= 500),
  add column replied_at timestamptz;
comment on column public.reviews.reply is 'Respuesta de Natu Mariel a la reseña (se muestra en la tienda).';
create policy "Administradoras responden reseñas" on public.reviews for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
