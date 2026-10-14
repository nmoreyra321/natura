import { Boxes, Camera, List, Plus, Search } from "lucide-react";
import Link from "next/link";

import { BulkSelectionProvider, SelectAllCheckbox, SelectProductCheckbox } from "@/components/admin/bulk-selection";
import { InventoryView } from "@/components/admin/inventory-view";
import { ReceiptImport } from "@/components/admin/receipt-import";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { LinkButton, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
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

const PAGE_SIZE = 50;
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

/** Pestañas de Productos: lista/edición o carga rápida de stock. */
function ProductTabs({ active }: { active: "lista" | "stock" | "boleta" }) {
  const tab = (on: boolean) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${on ? "bg-forest text-white" : "bg-warm-white shadow-soft hover:bg-sun"}`;
  return (
    <nav aria-label="Vista de productos" className="mt-4 flex flex-wrap gap-2">
      <Link href="/admin/productos" aria-current={active === "lista" ? "page" : undefined} className={tab(active === "lista")}>
        <List className="size-4" aria-hidden="true" /> Lista y edición
      </Link>
      <Link href="/admin/productos?vista=stock" aria-current={active === "stock" ? "page" : undefined} className={tab(active === "stock")}>
        <Boxes className="size-4" aria-hidden="true" /> Cargar stock
      </Link>
      <Link href="/admin/productos?vista=boleta" aria-current={active === "boleta" ? "page" : undefined} className={tab(active === "boleta")}>
        <Camera className="size-4" aria-hidden="true" /> Foto de la boleta
      </Link>
    </nav>
  );
}

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const vista = one(sp.vista);
  if (vista === "stock" || vista === "boleta") {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-bold">Productos</h1>
          <LinkButton href="/admin/productos/nuevo">
            <Plus className="size-5" aria-hidden="true" /> Nuevo producto
          </LinkButton>
        </div>
        <ProductTabs active={vista} />
        <div className="mt-5">
          {vista === "stock" ? (
            <InventoryView supabase={supabase} sp={sp} />
          ) : (
            <div className="mx-auto max-w-3xl">
              <ReceiptImport />
            </div>
          )}
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
    .order("updated_at", { ascending: false })
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
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const filtered = Boolean(q || estado || stock || oferta || categoria);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Productos</h1>
          <p className="text-muted tabular">
            {error ? "" : products && products.length > 0
              ? `Mostrando ${from + 1}–${from + products.length} de ${total} ${total === 1 ? "producto" : "productos"}`
              : `${total} ${total === 1 ? "producto" : "productos"}`}
          </p>
        </div>
        <LinkButton href="/admin/productos/nuevo">
          <Plus className="size-5" aria-hidden="true" /> Nuevo producto
        </LinkButton>
      </div>

      <ProductTabs active="lista" />

      <form method="get" className="mt-5 grid grid-cols-2 gap-3 rounded-3xl bg-warm-white p-4 shadow-soft md:grid-cols-[1.4fr_1fr_1fr_1.1fr_auto]">
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="aq" className="sr-only">Buscar por nombre</label>
          <input id="aq" name="q" type="search" defaultValue={q} placeholder="Buscar por nombre" className={`${inputClasses} h-11`} />
        </div>
        <div>
          <label htmlFor="ae" className="sr-only">Estado</label>
          <select id="ae" name="estado" defaultValue={estado} className={`${inputClasses} h-11`}>
            <option value="">Estado: todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
        </div>
        <div>
          <label htmlFor="as" className="sr-only">Stock</label>
          <select id="as" name="stock" defaultValue={stock} className={`${inputClasses} h-11`}>
            <option value="">Stock: todo</option>
            <option value="sin">Sin stock</option>
            <option value="bajo">Stock bajo</option>
          </select>
        </div>
        <div>
          <label htmlFor="ac" className="sr-only">Categoría</label>
          <select id="ac" name="categoria" defaultValue={categoria} className={`${inputClasses} h-11`}>
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
          <button type="submit" className={buttonClasses("secondary", "md")}>
            <Search className="size-4" aria-hidden="true" /> Filtrar
          </button>
        </div>
      </form>
      {filtered ? (
        <Link href="/admin/productos" className="mt-3 inline-block text-sm font-semibold text-coral-deep hover:underline">
          Limpiar filtros
        </Link>
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
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 px-1">
            <SelectAllCheckbox />
            <p className="text-sm text-muted">Elegí varios para publicarlos, pasarlos a borrador o cambiarles la categoría.</p>
          </div>
          <ul className="mt-3 flex flex-col gap-3 pb-28">
            {products.map((p) => {
              const img = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0];
              const src = img ? productImageUrl(img.storage_path) : null;
              const info = getPriceInfo(p.magazine_price, p.sale_price);
              const category = (p.category as unknown as { name: string } | null)?.name;
              return (
                <li key={p.id} className="flex flex-col gap-3 rounded-3xl bg-warm-white p-3 shadow-soft sm:flex-row sm:items-center sm:p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <SelectProductCheckbox id={p.id} name={p.name} />
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-white">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <ProductImageFallback className="size-full" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/admin/productos/${p.id}`} className="font-semibold hover:text-coral-deep">
                        {p.name}
                      </Link>
                      <p className="text-sm text-muted">
                        {[category ?? "Sin categoría", p.size].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-sm tabular">
                        <span className="font-bold">{formatARS(info.saleCents)}</span>
                        {info.hasDiscount ? (
                          <>
                            <span className="ml-2 text-muted line-through">{formatARS(info.magazineCents)}</span>
                            <span className="ml-2 font-semibold text-coral-deep">−{info.discountPercent}%</span>
                          </>
                        ) : null}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
                        <span className={`rounded-full px-2 py-0.5 ${p.status === "published" ? "bg-sage text-botanical-deep" : "bg-cream text-muted"}`}>
                          {p.status === "published" ? "Publicado" : "Borrador"}
                        </span>
                        {p.is_featured ? <span className="rounded-full bg-pink px-2 py-0.5">Destacado</span> : null}
                        {p.is_offer ? <span className="rounded-full bg-coral-soft px-2 py-0.5 text-coral-deep">Oferta</span> : null}
                        {p.stock === 0 ? <span className="rounded-full bg-coral-deep px-2 py-0.5 text-white">Sin stock</span> : null}
                      </div>
                    </div>
                  </div>
                  <ProductRowActions id={p.id} name={p.name} slug={p.slug} status={p.status as "draft" | "published"} stock={p.stock} />
                </li>
              );
            })}
          </ul>
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
