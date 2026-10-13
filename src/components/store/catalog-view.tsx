import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { EmptyStore } from "./empty-store";
import { ProductGrid } from "./product-card";
import {
  getActiveCategories,
  getCatalog,
  getPublishedCount,
  SORT_OPTIONS,
  type CatalogFilters,
} from "@/lib/catalog";

function pageHref(base: string, filters: CatalogFilters, page: number, fixedCategory: boolean) {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.category && !fixedCategory) p.set("categoria", filters.category);
  if (filters.min !== undefined) p.set("min", String(filters.min));
  if (filters.max !== undefined) p.set("max", String(filters.max));
  if (filters.offers) p.set("ofertas", "1");
  if (filters.sort && filters.sort !== "destacados") p.set("orden", filters.sort);
  if (page > 1) p.set("pagina", String(page));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function CatalogView({
  title,
  description,
  basePath,
  filters,
  fixedCategory = false,
}: {
  title: string;
  description?: string | null;
  basePath: string;
  filters: CatalogFilters;
  fixedCategory?: boolean;
}) {
  const [total, categories, result] = await Promise.all([
    getPublishedCount(),
    getActiveCategories(),
    getCatalog(filters),
  ]);

  if (!total) {
    return (
      <>
        <h1 className="sr-only">{title}</h1>
        <EmptyStore />
      </>
    );
  }

  const hasFilters = Boolean(
    filters.q || filters.min !== undefined || filters.max !== undefined || filters.offers || (!fixedCategory && filters.category),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-muted">{description}</p> : null}

      <form
        method="get"
        action={basePath}
        className="mt-6 grid grid-cols-2 gap-3 rounded-3xl border border-line bg-warm-white p-4 shadow-soft md:grid-cols-[2fr_1.3fr_1fr_1fr_1.3fr_auto]"
      >
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="f-q" className="mb-1 block text-sm font-semibold">
            Buscar
          </label>
          <input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder="Nombre del producto" maxLength={80} className={`${inputClasses} h-11`} />
        </div>
        {!fixedCategory ? (
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="f-cat" className="mb-1 block text-sm font-semibold">
              Categoría
            </label>
            <select id="f-cat" name="categoria" defaultValue={filters.category ?? ""} className={`${inputClasses} h-11`}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="f-min" className="mb-1 block text-sm font-semibold">
            Precio desde
          </label>
          <input id="f-min" name="min" type="number" min={0} step="1" inputMode="numeric" defaultValue={filters.min} placeholder="$" className={`${inputClasses} h-11`} />
        </div>
        <div>
          <label htmlFor="f-max" className="mb-1 block text-sm font-semibold">
            Hasta
          </label>
          <input id="f-max" name="max" type="number" min={0} step="1" inputMode="numeric" defaultValue={filters.max} placeholder="$" className={`${inputClasses} h-11`} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="f-orden" className="mb-1 block text-sm font-semibold">
            Ordenar
          </label>
          <select id="f-orden" name="orden" defaultValue={filters.sort} className={`${inputClasses} h-11`}>
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex flex-wrap items-end gap-3 md:col-span-1">
          <label className="flex h-11 cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" name="ofertas" value="1" defaultChecked={filters.offers} className="size-5 accent-[var(--coral-deep)]" />
            Ofertas
          </label>
          <button type="submit" className={buttonClasses("secondary", "md", "flex-1 md:flex-none")}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtrar
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm text-muted" aria-live="polite">
        <p>
          {result.total === 1 ? "1 producto" : `${result.total} productos`}
          {filters.q ? ` para “${filters.q}”` : ""}
        </p>
        {hasFilters ? (
          <Link href={basePath} className="font-semibold text-coral-deep hover:underline">
            Limpiar filtros
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        {!result.available ? (
          <p className="rounded-3xl bg-coral-soft p-6 text-center font-semibold">
            No pudimos cargar los productos en este momento. Probá de nuevo en unos minutos.
          </p>
        ) : result.products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
            <p className="font-display text-xl font-semibold">No encontramos productos con esos filtros.</p>
            <p className="mt-2 text-muted">Probá con otra búsqueda o mirá todo el catálogo.</p>
            <Link href={basePath} className={buttonClasses("outline", "md", "mt-5")}>
              Ver todos
            </Link>
          </div>
        ) : (
          <ProductGrid products={result.products} />
        )}
      </div>

      {result.pageCount > 1 ? (
        <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-3">
          {result.page > 1 ? (
            <Link href={pageHref(basePath, filters, result.page - 1, fixedCategory)} className={buttonClasses("outline")}>
              Anterior
            </Link>
          ) : null}
          <span className="text-sm text-muted tabular">
            Página {result.page} de {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(basePath, filters, result.page + 1, fixedCategory)} className={buttonClasses("outline")}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
