-- Revisión de seguridad (16/10).

-- 1) Reseñas: el público ve nombre, estrellas, comentario y respuesta, pero NO el pedido al que pertenecen
--    (con ese número se podía abrir el pedido de otra clienta).
revoke select on public.reviews from anon;
grant select (id, name, rating, comment, reply, replied_at, created_at) on public.reviews to anon;

-- 2) La tienda nunca escribe directo con la clave pública: se le quitan esos permisos (RLS ya lo frenaba; ahora son dos capas).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t.tablename);
  end loop;
end $$;

-- 3) El contador de intentos se limpia solo (borra lo de más de 2 días de vez en cuando).
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_seconds integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_seconds) * p_seconds);
  v_hits integer;
begin
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  insert into public.rate_limits as r (key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_max;
end;
$function$;

-- 4) create_order: se sacó el tope general de 30 pedidos por minuto (un molesto podía trabar las compras
--    de todas). El freno ahora es por persona: por conexión y por teléfono (en el servidor).
--    (Cuerpo completo aplicado en la base con «create or replace»; igual al anterior sin ese tope.)
