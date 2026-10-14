-- Línea o marca de Natura (Chronos, Ekos, Tododia, Kaiak…), independiente de la categoría (tipo de producto).
alter table public.products
  add column line text check (line is null or char_length(btrim(line)) between 2 and 40);

-- Repuesto: se deduce del nombre ("Repuesto …", "Kit … repuesto"), así no hay que marcarlo a mano.
alter table public.products
  add column is_refill boolean generated always as (name ~* 'repuesto') stored;

create index products_line_idx on public.products (line);

-- Categoría por tipo de producto para el cuidado facial (antes, la línea Chronos era una categoría).
insert into public.categories (name, slug, position)
values ('Rostro', 'rostro', 25)
on conflict (slug) do nothing;
