-- De dónde salió cada foto: la dirección de la foto en Natura, o null si la subió la
-- administradora. Así "Actualizar fotos de Natura" reemplaza solo las de Natura y nunca
-- toca las fotos propias.
alter table public.product_images add column source_url text
  check (source_url is null or char_length(source_url) <= 1000);

-- Las fotos del catálogo importado de Natura (13/10) y las traídas con "Traer foto de Natura".
update public.product_images
  set source_url = 'natura:importada'
  where created_at >= '2026-10-13 23:00:00+00' and created_at < '2026-10-14 00:00:00+00';
update public.product_images
  set source_url = 'natura:importada'
  where created_at >= '2026-10-14 22:49:00+00' and created_at < '2026-10-14 22:50:00+00';
