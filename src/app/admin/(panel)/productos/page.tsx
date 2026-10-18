import { Camera, Keyboard, Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ClearAllStock } from "@/components/admin/clear-all-stock";
import { BulkSelectionProvider, SelectAllCheckbox, SelectProductCheckbox } from "@/components/admin/bulk-selection";
import { InventoryCreate } from "@/components/admin/inventory-create";
import { LotQuickEntry } from "@/components/admin/lot-quick-entry";
import { ReceiptHistory } from "@/components/admin/receipt-history";
import { ReceiptImport } from "@/components/admin/receipt-import";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { ProgressiveList } from "@/components/admin/progressive-list";
import { AdminProductSearch } from "@/components/admin/admin-product-search";
import { ProductsHeader } from "@/components/admin/product-tabs";
import { LinkButton, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { CatalogFiltersToggle } from "@/components/store/catalog-filters-toggle";
import { ProductImageFallback } from "@/components/store/product-card";
import { requireAdmin } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { getPriceInfo } from "@/lib/pricing";
import { nameSearchPatterns } from "@/lib/search";

export const metadata = { title: "Productos" };

/** Leer la foto de la boleta puede tardar (la acción corre en esta página). */
export const maxDuration = 120;

// Todo el catálogo en una sola hoja: es más práctico bajar con el dedo que cambiar de página.
const PAGE_SIZE = 600;
/** Valor del filtro de categoría para ver los productos sin categoría. */
const NO_CATEGORY = "ninguna";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Arma el enlace a otra página conservando los filtros actuales. */
function pageHref(sp: Search, page: number) {
  const params = new URLSearchParams();
  for (const key of ["q", "estado", "stock", "categoria", "oferta"]) {
    const value = one(sp[key]);
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("pagina", String(page));
  const qs = params.toString();
  return qs ? `/admin/productos?${qs}` : "/admin/productos";
}

function NewProductButton() {
  return (
    <LinkButton href="/admin/productos/nuevo" size="sm">
      <Plus className="size-4" aria-hidden="true" /> Nuevo producto
    </LinkButton>
  );
}

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  // "boleta" es la dirección vieja de «Cargar caja de Natura»; "stock" (Contar stock) ahora es la pestaña Stock.
  const vista = one(sp.vista) === "boleta" ? "llego" : one(sp.vista);
  if (vista === "stock") {
    const q = one(sp.q).trim();
    redirect(q ? `/admin/productos?q=${encodeURIComponent(q)}` : "/admin/productos");
  }
  if (vista === "llego") {
    const byHand = one(sp.modo) === "mano";
    const modeClass = (on: boolean) =>
      `inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-5 text-lg font-extrabold ${on ? "bg-coral-deep text-white shadow-soft" : "bg-warm-white shadow-soft hover:bg-sun"}`;
    return (
      <div className="mx-auto max-w-6xl">
        <ProductsHeader active={vista} action={<NewProductButton />} />
        <div className="mt-5">
            <div className="mx-auto max-w-3xl">
              <p className="text-base text-muted">Lo que cargues se suma al stock que ya tenías.</p>
              <nav aria-label="Cómo cargar" className="mt-3 mb-6 flex flex-col gap-3">
                <Link href="/admin/productos?vista=llego" aria-current={!byHand ? "page" : undefined} className={modeClass(!byHand)}>
                  <Camera className="size-6" aria-hidden="true" /> Con la foto de la factura
                </Link>
                <Link
                  href="/admin/productos?vista=llego&modo=mano"
                  aria-current={byHand ? "page" : undefined}
                  className={modeClass(byHand)}
                >
                  <Keyboard className="size-6" aria-hidden="true" /> A mano, producto por producto
                </Link>
              </nav>
              {byHand ? (
                <LotQuickEntry mode="llegada" categories={(await supabase.from("categories").select("id, name").order("position")).data ?? []} />
              ) : (
                <>
                  <ReceiptImport />
                  <h2 className="mt-10 mb-3 font-display text-xl font-bold">Facturas cargadas</h2>
                  <ReceiptHistory supabase={supabase} />
                </>
              )}
            </div>
        </div>
      </div>
    );
  }

  const q = one(sp.q).trim().slice(0, 80);
  const estado = one(sp.estado);
  const stock = one(sp.stock);
  const oferta = one(sp.oferta) === "1";
  const categoria = one(sp.categoria);
  const pageRaw = Number(one(sp.pagina) || "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 10000 ? pageRaw : 1;
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("products")
    .select(
      "id, name, slug, size, magazine_price, sale_price, stock, status, is_featured, is_offer, updated_at, category:categories(name), images:product_images(storage_path, position)",
      { count: "exact" },
    )
    // Por nombre: al cargar stock la lista no se reordena (si fuera por «último cambio», el producto saltaría arriba).
    .order("name")
    // Desempate estable: sin esto, productos con la misma fecha podrían repetirse o saltearse entre páginas.
    .order("id");
  for (const pattern of nameSearchPatterns(q)) query = query.filter("name", "imatch", pattern);
  if (estado === "published" || estado === "draft") query = query.eq("status", estado);
  if (stock === "sin") query = query.eq("stock", 0);
  if (stock === "bajo") query = query.gt("stock", 0).lte("stock", LOW_STOCK_THRESHOLD);
  if (oferta) query = query.eq("is_offer", true);
  if (categoria === NO_CATEGORY) query = query.is("category_id", null);
  else if (/^[0-9a-f-]{36}$/.test(categoria)) query = query.eq("category_id", categoria);

  const [{ data, count, error: queryError }, { data: categories }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from("categories").select("id, name").order("position"),
  ]);
  // Una página fuera de rango (por ejemplo, después de borrar productos) no es un error: se muestra vacía.
  const outOfRange = queryError?.code === "PGRST103";
  const error = outOfRange ? null : queryError;
  const products = outOfRange ? [] : data;
  const total = count ?? 0;
  const { count: withStock } = await supabase.from("products").select("id", { count: "exact", head: true }).gt("stock", 0);
  const withStockCount = withStock ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const filtered = Boolean(q || estado || stock || oferta || categoria);

  return (
    <div className="mx-auto max-w-6xl">
      <ProductsHeader
        active="lista"
        action={<NewProductButton />}
        subtitle={
          error
            ? ""
            : products && products.length > 0
              ? `Mostrando ${from + 1}–${from + products.length} de ${total} ${total === 1 ? "producto" : "productos"}`
              : `${total} ${total === 1 ? "producto" : "productos"}`
        }
      />

      <p className="mt-3 text-base text-muted">
        Tocá <strong className="text-forest">+</strong> o <strong className="text-forest">−</strong> para cambiar cuánto tenés. Tocá el nombre para editarlo.
      </p>
      <ClearAllStock withStock={withStockCount} />

      <form
        method="get"
        className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[1.6fr_1fr_1fr_1.2fr_auto] md:rounded-2xl md:bg-warm-white md:p-2.5 md:shadow-soft"
      >
        <CatalogFiltersToggle
          activeCount={[estado, stock, categoria, oferta].filter(Boolean).length}
          search={
            <>
              <label htmlFor="aq" className="sr-only">Buscar por nombre</label>
              <AdminProductSearch id="aq" defaultValue={q} placeholder="Buscar por nombre (ej.: crema ekos)" />
            </>
          }
        >
        <div>
          <label htmlFor="ae" className="sr-only">Estado</label>
          <select id="ae" name="estado" defaultValue={estado} className={`${inputClasses} h-10 text-sm`}>
            <option value="">Estado: todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
        </div>
        <div>
          <label htmlFor="as" className="sr-only">Stock</label>
          <select id="as" name="stock" defaultValue={stock} className={`${inputClasses} h-10 text-sm`}>
            <option value="">Stock: todo</option>
            <option value="sin">Sin stock</option>
            <option value="bajo">Stock bajo</option>
          </select>
        </div>
        <div>
          <label htmlFor="ac" className="sr-only">Categoría</label>
          <select id="ac" name="categoria" defaultValue={categoria} className={`${inputClasses} h-10 text-sm`}>
            <option value="">Categoría: todas</option>
            <option value={NO_CATEGORY}>Sin categoría</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 md:col-span-1 md:justify-start">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="oferta" value="1" defaultChecked={oferta} className="size-5 accent-[var(--coral-deep)]" />
            Ofertas
          </label>
          <button type="submit" className={buttonClasses("secondary", "sm")}>
            <Search className="size-4" aria-hidden="true" /> Filtrar
          </button>
        </div>
        </CatalogFiltersToggle>
      </form>
      {filtered ? (
        <Link href="/admin/productos" className="mt-3 inline-block text-sm font-semibold text-coral-deep hover:underline">
          Limpiar filtros
        </Link>
      ) : null}
      {q.length >= 2 && products && products.length > 0 ? (
        <InventoryCreate name={q} categories={categories ?? []} notFound={false} initialOpen={one(sp.crear) === "1"} />
      ) : null}

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar los productos.</p>
      ) : !products || products.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <p className="font-display text-xl font-bold">
            {page > 1
              ? "Esta página no tiene productos."
              : filtered ? "No hay productos con esos filtros." : "Todavía no hay productos."}
          </p>
          {page > 1 ? (
            <Link href={pageHref(sp, 1)} className="mt-3 inline-block font-semibold text-coral-deep hover:underline">
              Ir a la primera página
            </Link>
          ) : null}
          {q.length >= 2 && page === 1 ? (
            <div className="mt-4 text-left">
              <InventoryCreate name={q} categories={categories ?? []} initialOpen={one(sp.crear) === "1"} />
            </div>
          ) : null}
          {!filtered && page === 1 ? (
            <LinkButton href="/admin/productos/nuevo" className="mt-4">
              <Plus className="size-5" aria-hidden="true" /> Crear el primero
            </LinkButton>
          ) : null}
        </div>
      ) : (
        <BulkSelectionProvider
          key={`${page}|${q}|${estado}|${stock}|${categoria}|${oferta}`}
          products={products.map((p) => ({ id: p.id, stock: p.stock }))}
          categories={categories ?? []}
        >
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
            <SelectAllCheckbox />
            <p className="hidden text-xs text-muted sm:block">Elegí varios para publicar, pasar a borrador o cambiar la categoría.</p>
          </div>
          <ProgressiveList className="mt-2 mb-28 divide-y divide-line/70 overflow-hidden rounded-2xl bg-warm-white shadow-soft">
            {products.map((p) => {
              const img = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0];
              const src = img ? productImageUrl(img.storage_path) : null;
              const info = getPriceInfo(p.magazine_price, p.sale_price);
              const category = (p.category as unknown as { name: string } | null)?.name;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 hover:bg-cream/60">
                  <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
                    <SelectProductCheckbox id={p.id} name={p.name} />
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-white">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <ProductImageFallback className="size-full" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/admin/productos/${p.id}`} className="line-clamp-2 text-base font-bold hover:text-coral-deep">
                        {p.name}
                      </Link>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                        <span className="tabular">
                          <span className="font-bold text-forest">{formatARS(info.saleCents)}</span>
                          {info.hasDiscount ? (
                            <>
                              <span className="ml-1 line-through">{formatARS(info.magazineCents)}</span>
                              <span className="ml-1 font-semibold text-coral-deep">−{info.discountPercent}%</span>
                            </>
                          ) : null}
                        </span>
                        <span>{[category ?? "Sin categoría", p.size].filter(Boolean).join(" · ")}</span>
                        {p.status !== "published" ? <span className="rounded-full bg-cream px-1.5 font-bold text-muted">Borrador</span> : null}
                        {p.is_featured ? <span className="rounded-full bg-pink px-1.5 font-bold text-forest">Destacado</span> : null}
                        {p.is_offer ? <span className="rounded-full bg-coral-soft px-1.5 font-bold text-coral-deep">Oferta</span> : null}
                        {p.stock === 0 ? <span className="rounded-full bg-coral-deep px-1.5 font-bold text-white">Sin stock</span> : null}
                      </p>
                    </div>
                  </div>
                  <ProductRowActions id={p.id} name={p.name} slug={p.slug} status={p.status as "draft" | "published"} stock={p.stock} />
                </li>
              );
            })}
          </ProgressiveList>
        </BulkSelectionProvider>
      )}

      {pageCount > 1 && products && products.length > 0 ? (
        <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={pageHref(sp, page - 1)} className={buttonClasses("outline")}>
              Anterior
            </Link>
          ) : null}
          <span className="text-sm text-muted tabular">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(sp, page + 1)} className={buttonClasses("outline")}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
