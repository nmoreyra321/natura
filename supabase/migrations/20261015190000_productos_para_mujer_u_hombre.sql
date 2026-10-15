alter table public.products add column gender text check (gender is null or gender in ('femenino', 'masculino'));
comment on column public.products.gender is 'Para quién es: femenino, masculino, o null (para todos).';

update public.products p set gender = 'masculino'
where p.name ~* '(masculin|homem|hombre)'
   or p.category_id in (select c.id from public.categories c where c.name = 'Hombre');

update public.products p set gender = 'femenino'
where p.gender is null and p.name ~* '(femenin|mujer)';
