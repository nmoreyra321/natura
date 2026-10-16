-- Natu Mariel agrega, apaga y borra localidades de envío desde el panel.
create policy "Administradoras agregan zonas de envío"
  on public.shipping_zones for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Administradoras borran zonas de envío"
  on public.shipping_zones for delete
  to authenticated
  using ((select public.is_admin()));

grant insert, delete on public.shipping_zones to authenticated;
