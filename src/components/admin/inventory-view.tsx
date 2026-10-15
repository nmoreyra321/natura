import { Search } from "lucide-react";
import Link from "next/link";

import { AdminProductSearch } from "@/components/admin/admin-product-search";
import { InventoryCreate } from "@/components/admin/inventory-create";
import { InventoryList, type InventoryRow } from "@/components/admin/inventory-list";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { nameSearchPatterns } from "@/lib/search";
import type { AdminContext } from "@/lib/auth";

// Todo el catálogo en una sola hoja: es más práctico bajar con el dedo que cambiar de página.
const PAGE_SIZE = 600;
const NO_CATEGORY = "ninguna";
const BASE = "/admin/productos";

type Search = Record<string, string | string[] | undefined>;
type Client = AdminContext["supabase"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function pageHref(sp: Search, page: number) {
  const params = new URLSearchParams({ vista: "stock" });
  for (const key of ["q", "categoria", "ver"]) {
    const value = one(sp[key]);
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("pagina", String(page));
  return `${BASE}?${params.toString()}`;
}

/** Vista "Cargar stock" de Productos: lista rápida para escribir cuántos hay de cada uno. */
export async function InventoryView({ supabase, sp }: { supabase: Client; sp: Search }) {
  const q = one(sp.q).trim().slice(0, 80);
  const categoria = one(sp.categoria);
  const ver = one(sp.ver); // "" = todos · "con" = con stock · "sin" = sin stock
  const pageRaw = Number(one(sp.pagina) || "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 10000 ? pageRaw : 1;
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("products")
    .select("id, name, size, stock, status, images:product_images(storage_path, position)", { count: "exact" })
    .order("name")
    .order("id");
  for (const pattern of nameSearchPatterns(q)) query = query.filter("name", "imatch", pattern);
  if (categoria === NO_CATEGORY) query = query.is("category_id", null);
  else if (/^[0-9a-f-]{36}$/.test(categoria)) query = query.eq("category_id", categoria);
  if (ver === "con") query = query.gt("stock", 0);
  if (ver === "sin") query = query.eq("stock", 0);

  const [{ data, count, error }, { data: categories }, { count: withStock }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from("categories").select("id, name").order("position"),
    supabase.from("products").select("id", { count: "exact", head: true }).gt("stock", 0),
  ]);
  const outOfRange = error?.code === "PGRST103";
  const rows: InventoryRow[] = (outOfRange ? [] : (data ?? [])).map((p) => ({
    id: p.id,
    name: p.name,
    size: p.size,
    stock: p.stock,
    status: p.status === "published" ? "published" : "draft",
    image: [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
  }));
  const total = count ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-muted">
        Escribí cuántos tenés de cada producto y apretá Enter: se guarda y pasa al siguiente. Tenés stock cargado en{" "}
        <strong className="text-forest">{withStock ?? 0}</strong> productos.
      </p>

      <form method="get" action={BASE} className="mt-5 grid grid-cols-2 gap-2 rounded-3xl bg-warm-white p-3 shadow-soft sm:grid-cols-[1.5fr_1fr_1fr_auto]">
        <input type="hidden" name="vista" value="stock" />
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="iq" className="sr-only">
            Buscar por nombre
          </label>
          <AdminProductSearch id="iq" defaultValue={q} placeholder="Buscar (ej.: ekos)" mode="stock" />
        </div>
        <div>
          <label htmlFor="ic" className="sr-only">
            Categoría
          </label>
          <select id="ic" name="categoria" defaultValue={categoria} className={`${inputClasses} h-11`}>
            <option value="">Todas las categorías</option>
            <option value={NO_CATEGORY}>Sin categoría</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="iv" className="sr-only">
            Mostrar
          </label>
          <select id="iv" name="ver" defaultValue={ver} className={`${inputClasses} h-11`}>
            <option value="">Todos</option>
            <option value="sin">Sin stock (para cargar)</option>
            <option value="con">Con stock</option>
          </select>
        </div>
        <button type="submit" className={buttonClasses("secondary", "md", "col-span-2 sm:col-span-1")}>
          <Search className="size-4" aria-hidden="true" /> Buscar
        </button>
      </form>

      <p className="mt-4 text-sm text-muted tabular">
        {total > 0 && rows.length > 0
          ? `Mostrando ${from + 1}–${from + rows.length} de ${total} productos`
          : error && !outOfRange
            ? ""
            : "No hay productos con esos filtros."}
      </p>

      {error && !outOfRange ? (
        <p className="mt-4 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar los productos.</p>
      ) : rows.length > 0 ? (
        <div className="mt-3">
          <InventoryList key={`${page}|${q}|${categoria}|${ver}`} rows={rows} />
        </div>
      ) : page > 1 ? (
        <Link href={pageHref(sp, 1)} className="mt-3 inline-block font-semibold text-coral-deep hover:underline">
          Ir a la primera página
        </Link>
      ) : q.length >= 2 ? (
        <InventoryCreate name={q} categories={categories ?? []} />
      ) : null}

      {pageCount > 1 && rows.length > 0 ? (
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
