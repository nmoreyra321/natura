-- Redes de la tienda para la página «Quiénes somos» (Facebook, donde Mariel hace los vivos, e Instagram).
alter table public.store_settings add column facebook_url text
  check (facebook_url is null or (char_length(facebook_url) <= 200 and facebook_url ~ '^https://(www\.|m\.|web\.)?(facebook\.com|fb\.com|fb\.me)/'));
alter table public.store_settings add column instagram_url text
  check (instagram_url is null or (char_length(instagram_url) <= 200 and instagram_url ~ '^https://(www\.)?instagram\.com/'));
comment on column public.store_settings.facebook_url is 'Página o perfil de Facebook de la tienda (donde se hacen los vivos).';
comment on column public.store_settings.instagram_url is 'Instagram de la tienda.';
