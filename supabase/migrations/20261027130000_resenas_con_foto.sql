-- Reseñas con foto: la foto se guarda en el almacenamiento de fotos (carpeta reviews/).
alter table public.reviews add column photo_path text check (photo_path is null or char_length(photo_path) <= 200);
