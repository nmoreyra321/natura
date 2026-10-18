import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { CatalogFiltersToggle } from "./catalog-filters-toggle";
import { EmptyStore } from "./empty-store";
import { ProductGrid } from "./product-card";
import { CatalogSearchField } from "./search-box";
import {
  getActiveCategories,
  getActiveLines,
  getCatalog,
  getPublishedCount,
  SORT_OPTIONS,
  type CatalogFilters,
} from "@/lib/catalog";

function pageHref(base: string, filters: CatalogFilters, page: number, fixedCategory: boolean) {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.category && !fixedCategory) p.set("categoria", filters.category);
  if (filters.line) p.set("linea", filters.line);
  if (filters.refills) p.set("repuestos", "1");
  if (filters.min !== undefined) p.set("min", String(filters.min));
  if (filters.max !== undefined) p.set("max", String(filters.max));
  if (filters.offers) p.set("ofertas", "1");
  if (filters.inStock) p.set("stock", "1");
  if (filters.gender) p.set("para", filters.gender);
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
  const [total, categories, lines, result] = await Promise.all([
    getPublishedCount(),
    getActiveCategories(),
    getActiveLines(),
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
    filters.q ||
      filters.line ||
      filters.refills ||
      filters.min !== undefined ||
      filters.max !== undefined ||
      filters.offers ||
      filters.inStock ||
      filters.gender ||
      (!fixedCategory && filters.category),
  );

  const activeCount = [
    filters.line,
    filters.refills,
    filters.min !== undefined || filters.max !== undefined,
    // En «Todos los productos», ofertas es la página «Ofertas» en sí (no un filtro elegido).
    fixedCategory && filters.offers,
    filters.inStock,
    filters.gender,
    !fixedCategory && filters.category,
    filters.sort !== "destacados",
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-muted">{description}</p> : null}

      <form
        method="get"
        action={basePath}
        className={`mt-4 grid grid-cols-2 gap-3 md:mt-6 md:rounded-3xl md:border md:border-line md:bg-warm-white md:p-4 md:shadow-soft ${fixedCategory ? "md:grid-cols-[2fr_1.3fr_1fr_1fr_1fr_1.3fr]" : "md:grid-cols-3 lg:grid-cols-[1.8fr_1.2fr_1.1fr_1fr_0.9fr_0.9fr_1.1fr]"}`}
      >
        <CatalogFiltersToggle
          activeCount={activeCount}
          search={
            <>
              <label htmlFor="f-q" className="sr-only md:not-sr-only md:mb-1 md:block md:text-sm md:font-semibold">
                Buscar
              </label>
              <CatalogSearchField id="f-q" defaultValue={filters.q} />
            </>
          }
        >
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
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="f-linea" className="mb-1 block text-sm font-semibold">
            Línea
          </label>
          <select id="f-linea" name="linea" defaultValue={filters.line ?? ""} className={`${inputClasses} h-11`}>
            <option value="">Todas</option>
            {lines.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="f-para" className="mb-1 block text-sm font-semibold">
            Género
          </label>
          <select id="f-para" name="para" defaultValue={filters.gender ?? ""} className={`${inputClasses} h-11`}>
            <option value="">Todos</option>
            <option value="mujer">Mujer</option>
            <option value="hombre">Hombre</option>
            <option value="ninos">Niños</option>
          </select>
        </div>
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
        <div className="col-span-2 flex flex-wrap items-end gap-x-5 gap-y-3 md:col-span-full">
          <label className="flex h-11 cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" name="ofertas" value="1" defaultChecked={filters.offers} className="size-5 accent-[var(--coral-deep)]" />
            Ofertas
          </label>
          <label className="flex h-11 cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} className="size-5 accent-[var(--coral-deep)]" />
            Solo con stock
          </label>
          <label className="flex h-11 cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" name="repuestos" value="1" defaultChecked={filters.refills} className="size-5 accent-[var(--coral-deep)]" />
            Solo repuestos
          </label>
          <button type="submit" className={buttonClasses("secondary", "md", "flex-1 md:ml-auto md:flex-none")}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtrar
          </button>
        </div>
        </CatalogFiltersToggle>
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
            <p className="font-display text-xl font-bold">No encontramos productos con esos filtros.</p>
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
