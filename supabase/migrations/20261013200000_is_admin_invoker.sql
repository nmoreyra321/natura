-- is_admin() pasa a SECURITY INVOKER: lee admin_users con los permisos de quien la llama.
-- La política "Cada administradora ve su propio registro" alcanza para responder,
-- y los visitantes anónimos simplemente obtienen false.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;
