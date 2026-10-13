import { Plus, Search } from "lucide-react";
import Link from "next/link";

import { ProductRowActions } from "@/components/admin/product-row-actions";
import { LinkButton, buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { ProductImageFallback } from "@/components/store/product-card";
import { requireAdmin } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { getPriceInfo } from "@/lib/pricing";

export const metadata = { title: "Productos" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80);
  const estado = one(sp.estado);
  const stock = one(sp.stock);
  const oferta = one(sp.oferta) === "1";
  const categoria = one(sp.categoria);

  let query = supabase
    .from("products")
    .select(
      "id, name, slug, size, magazine_price, sale_price, stock, status, is_featured, is_offer, updated_at, category:categories(name), images:product_images(storage_path, position)",
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  if (estado === "published" || estado === "draft") query = query.eq("status", estado);
  if (stock === "sin") query = query.eq("stock", 0);
  if (stock === "bajo") query = query.gt("stock", 0).lte("stock", LOW_STOCK_THRESHOLD);
  if (oferta) query = query.eq("is_offer", true);
  if (/^[0-9a-f-]{36}$/.test(categoria)) query = query.eq("category_id", categoria);

  const [{ data: products, error }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("position"),
  ]);
  const filtered = Boolean(q || estado || stock || oferta || categoria);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Productos</h1>
          <p className="text-muted">{products ? `${products.length} ${products.length === 1 ? "producto" : "productos"}` : ""}</p>
        </div>
        <LinkButton href="/admin/productos/nuevo">
          <Plus className="size-5" aria-hidden="true" /> Nuevo producto
        </LinkButton>
      </div>

      <form method="get" className="mt-6 grid grid-cols-2 gap-3 rounded-3xl bg-warm-white p-4 shadow-soft md:grid-cols-[1.4fr_1fr_1fr_1.1fr_auto]">
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
          <p className="font-display text-xl font-semibold">
            {filtered ? "No hay productos con esos filtros." : "Todavía no hay productos."}
          </p>
          {!filtered ? (
            <LinkButton href="/admin/productos/nuevo" className="mt-4">
              <Plus className="size-5" aria-hidden="true" /> Crear el primero
            </LinkButton>
          ) : null}
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {products.map((p) => {
            const img = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0];
            const src = img ? productImageUrl(img.storage_path) : null;
            const info = getPriceInfo(p.magazine_price, p.sale_price);
            const category = (p.category as unknown as { name: string } | null)?.name;
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-3xl bg-warm-white p-3 shadow-soft sm:flex-row sm:items-center sm:p-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
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
      )}
    </div>
  );
}
