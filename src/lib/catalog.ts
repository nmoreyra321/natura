import "server-only";

import { cache } from "react";

import { meaningfulWords, nameSearchPatterns } from "@/lib/search";
import { slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import type { CategoryRow, ProductImageRow, ProductRow } from "@/lib/supabase/types";

/** Producto tal como lo ve la tienda pública. */
export type PublicProduct = Pick<
  ProductRow,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "size"
  | "magazine_price"
  | "sale_price"
  | "stock"
  | "is_featured"
  | "is_offer"
  | "discount_percent"
  | "updated_at"
  | "line"
  | "is_refill"
> & {
  category: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  images: Pick<ProductImageRow, "id" | "storage_path" | "alt" | "position">[];
};

export type PublicCategory = Pick<CategoryRow, "id" | "name" | "slug" | "description"> & {
  productCount: number;
  /** Foto de un producto de la categoría (con stock y destacado primero), para mostrarla con imagen. */
  image: string | null;
};

const PRODUCT_SELECT =
  "id, name, slug, description, size, magazine_price, sale_price, stock, is_featured, is_offer, discount_percent, updated_at, line, is_refill, category:categories(id, name, slug), images:product_images(id, storage_path, alt, position)";

export const SORT_OPTIONS = {
  destacados: "Destacados",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
  descuento: "Mayor descuento",
  nuevos: "Más nuevos",
} as const;

export type SortOption = keyof typeof SORT_OPTIONS;

export type CatalogFilters = {
  q?: string;
  category?: string;
  /** Slug de la línea Natura (Chronos, Ekos, Tododia…). */
  line?: string;
  /** Solo repuestos (refill). */
  refills?: boolean;
  min?: number;
  max?: number;
  offers?: boolean;
  /** Solo lo que hay en stock. */
  inStock?: boolean;
  /** "mujer" saca lo masculino, "hombre" saca lo femenino (lo que es para todos aparece en los dos). */
  /** "ninos" = la categoría Infantiles (que no aparece en Mujer ni en Hombre). */
  gender?: "mujer" | "hombre" | "ninos";
  sort?: SortOption;
  page?: number;
};

export const PAGE_SIZE = 24;

export type CatalogResult = {
  products: PublicProduct[];
  total: number;
  page: number;
  pageCount: number;
  /** false si la base no está configurada o no respondió. */
  available: boolean;
};

function sortImages<T extends { images: { position: number }[] }>(p: T): T {
  return { ...p, images: [...p.images].sort((a, b) => a.position - b.position) };
}

/** Lee parámetros de la URL de forma tolerante. */
export function parseCatalogFilters(
  params: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const first = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const num = (key: string) => {
    const raw = first(key);
    if (!raw) return undefined;
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const sortRaw = first("orden");
  const pageRaw = Number(first("pagina") ?? "1");
  return {
    q: first("q")?.trim().slice(0, 80) || undefined,
    category: first("categoria")?.trim().slice(0, 80) || undefined,
    line: first("linea")?.trim().slice(0, 60) || undefined,
    refills: first("repuestos") === "1",
    min: num("min"),
    max: num("max"),
    offers: first("ofertas") === "1",
    inStock: first("stock") === "1",
    gender: ["mujer", "hombre", "ninos"].includes(first("para") ?? "") ? (first("para") as "mujer" | "hombre" | "ninos") : undefined,
    sort: sortRaw && sortRaw in SORT_OPTIONS ? (sortRaw as SortOption) : "destacados",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 1000) : 1,
  };
}

export async function getCatalog(filters: CatalogFilters): Promise<CatalogResult> {
  const supabase = createPublicClient();
  const page = filters.page ?? 1;
  if (!supabase) return { products: [], total: 0, page, pageCount: 0, available: false };

  let categoryId: string | null = null;
  if (filters.category) {
    const category = await getCategoryBySlug(filters.category);
    if (!category) return { products: [], total: 0, page, pageCount: 0, available: true };
    categoryId = category.id;
  }

  let lineName: string | null = null;
  if (filters.line) {
    const line = (await getActiveLines()).find((l) => l.slug === filters.line);
    if (!line) return { products: [], total: 0, page, pageCount: 0, available: true };
    lineName = line.name;
  }

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("status", "published");

  for (const pattern of nameSearchPatterns(meaningfulWords(filters.q ?? "").join(" "))) query = query.filter("name", "imatch", pattern);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (lineName) query = query.eq("line", lineName);
  if (filters.refills) query = query.eq("is_refill", true);
  if (filters.min !== undefined) query = query.gte("sale_price", filters.min);
  if (filters.max !== undefined) query = query.lte("sale_price", filters.max);
  if (filters.offers) query = query.eq("is_offer", true).gt("discount_percent", 0);
  if (filters.inStock) query = query.eq("in_stock", true);
  if (filters.gender) {
    // Los productos de la categoría Infantiles son «Niños»: no aparecen en Mujer ni en Hombre.
    const kids = await getCategoryBySlug("infantiles");
    if (filters.gender === "ninos") {
      if (!kids) return { products: [], total: 0, page, pageCount: 0, available: true };
      query = query.eq("category_id", kids.id);
    } else {
      query = query.or(filters.gender === "mujer" ? "gender.is.null,gender.eq.femenino" : "gender.is.null,gender.eq.masculino");
      if (kids) query = query.or(`category_id.is.null,category_id.neq.${kids.id}`);
    }
  }

  // Siempre primero lo que se puede comprar; después, el orden elegido.
  query = query.order("in_stock", { ascending: false });
  switch (filters.sort) {
    case "precio-asc":
      query = query.order("sale_price", { ascending: true });
      break;
    case "precio-desc":
      query = query.order("sale_price", { ascending: false });
      break;
    case "descuento":
      query = query.order("discount_percent", { ascending: false });
      break;
    case "nuevos":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("created_at", {
        ascending: false,
      });
  }
  query = query.order("id");

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);

  if (error) {
    // Un rango fuera de límites (página inexistente) no es un error de disponibilidad.
    if (error.code === "PGRST103") {
      return { products: [], total: count ?? 0, page, pageCount: 0, available: true };
    }
    console.error("[catalog] Error al leer productos:", error.message);
    return { products: [], total: 0, page, pageCount: 0, available: false };
  }

  const total = count ?? 0;
  return {
    products: (data as unknown as PublicProduct[]).map(sortImages),
    total,
    page,
    pageCount: Math.ceil(total / PAGE_SIZE),
    available: true,
  };
}

export type SearchSuggestion = {
  slug: string;
  name: string;
  size: string | null;
  salePrice: number;
  magazinePrice: number;
  image: string | null;
};

type SuggestionRow = {
  name: string;
  slug: string;
  size: string | null;
  sale_price: number;
  magazine_price: number;
  stock: number;
  is_featured: boolean;
  images: { storage_path: string; position: number }[] | null;
};

const SUGGESTION_COLUMNS = "name, slug, size, sale_price, magazine_price, stock, is_featured, images:product_images(storage_path, position)";

/** Sin tildes ni mayúsculas, para comparar palabras. */
const plain = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Sugerencias para el buscador instantáneo (productos publicados). Primero los que tienen todas las palabras;
 * si son pocos, se suman los que tienen las palabras importantes (sin «eau de parfum», «para»…) y, al final,
 * los que tienen alguna de ellas. Así «kaiak eau de parfum» encuentra «Kaiak Femenino» aunque no diga «parfum».
 */
export async function searchSuggestions(q: string, limit = 6): Promise<SearchSuggestion[] | null> {
  const patterns = nameSearchPatterns(q);
  if (patterns.length === 0) return [];
  const supabase = createPublicClient();
  if (!supabase) return null;

  const run = async (pats: string[], max: number): Promise<SuggestionRow[] | null> => {
    let query = supabase.from("products").select(SUGGESTION_COLUMNS).eq("status", "published");
    for (const pattern of pats) query = query.filter("name", "imatch", pattern);
    const { data, error } = await query.order("in_stock", { ascending: false }).order("is_featured", { ascending: false }).order("name").limit(max);
    if (error) {
      console.error("[catalog] Error en sugerencias de búsqueda:", error.message);
      return null;
    }
    return (data ?? []) as SuggestionRow[];
  };

  const strict = await run(patterns, limit);
  if (!strict) return null;
  const found = new Map<string, SuggestionRow>(strict.map((r) => [r.slug, r]));

  const words = meaningfulWords(q);
  if (found.size < limit) {
    const relaxedPatterns = nameSearchPatterns(words.join(" "));
    if (relaxedPatterns.join("|") !== patterns.join("|")) {
      for (const r of (await run(relaxedPatterns, limit)) ?? []) if (!found.has(r.slug)) found.set(r.slug, r);
    }
  }
  // Todavía pocas: los que tengan alguna de las palabras (de más a menos palabras en común).
  const loose = new Map<string, SuggestionRow>();
  if (found.size < Math.min(limit, 12) && words.length > 1) {
    for (const word of words.filter((w) => w.length >= 3).slice(0, 3)) {
      for (const r of (await run(nameSearchPatterns(word), limit)) ?? []) if (!found.has(r.slug)) loose.set(r.slug, r);
    }
  }
  const score = (r: SuggestionRow) => words.filter((w) => plain(r.name).includes(plain(w))).length;
  const extra = [...loose.values()].sort((a, b) => score(b) - score(a) || Number(b.stock > 0) - Number(a.stock > 0));

  return [...found.values(), ...extra].slice(0, limit).map((row) => ({
    slug: row.slug,
    name: row.name,
    size: row.size,
    salePrice: Number(row.sale_price),
    magazinePrice: Number(row.magazine_price),
    image: [...(row.images ?? [])].sort((x, y) => x.position - y.position)[0]?.storage_path ?? null,
  }));
}

/** Acorta un nombre de producto para el cartel del buscador (sin cortar palabras). */
function shortHint(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= 30) return clean;
  const cut = clean.slice(0, 30);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 12));
}

/**
 * Nombres de productos reales con stock para que el buscador los «escriba» de ejemplo.
 * Se mezclan tipos distintos (perfume, crema, labial…) tomando uno de cada grupo por vuelta.
 */
export async function getSearchHints(max = 8): Promise<string[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select("name")
    .eq("status", "published")
    .eq("in_stock", true)
    .order("is_featured", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error || !data) return [];
  const groups = new Map<string, string[]>();
  for (const row of data) {
    const hint = shortHint(row.name);
    const key = hint.split(" ")[0]?.toLowerCase() ?? hint;
    const list = groups.get(key) ?? [];
    if (!list.includes(hint)) list.push(hint);
    groups.set(key, list);
  }
  const out: string[] = [];
  for (let round = 0; out.length < max; round++) {
    let added = false;
    for (const list of groups.values()) {
      if (list[round] && out.length < max) {
        out.push(list[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

/** Cantidad total de productos publicados (null si la base no está disponible). */
export const getPublishedCount = cache(async (): Promise<number | null> => {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  if (error) {
    console.error("[catalog] Error al contar productos:", error.message);
    return null;
  }
  return count ?? 0;
});

export async function getHighlights(limit = 8, { inStockOnly = false }: { inStockOnly?: boolean } = {}) {
  const supabase = createPublicClient();
  if (!supabase) return { featured: [], offers: [], latest: [] };

  // Con stock primero en cada sección (o solo con stock, para la pantalla principal).
  const base = () => {
    const q = supabase.from("products").select(PRODUCT_SELECT).eq("status", "published");
    return inStockOnly ? q.eq("in_stock", true) : q.order("in_stock", { ascending: false });
  };

  const [featured, offers, latest] = await Promise.all([
    base().eq("is_featured", true).order("updated_at", { ascending: false }).limit(limit),
    base()
      .eq("is_offer", true)
      .gt("discount_percent", 0)
      .order("discount_percent", { ascending: false })
      .limit(limit),
    base().order("created_at", { ascending: false }).limit(limit),
  ]);

  const rows = (r: { data: unknown }) => ((r.data ?? []) as PublicProduct[]).map(sortImages);
  return { featured: rows(featured), offers: rows(offers), latest: rows(latest) };
}

/** Lo más vendido de los últimos 90 días (en la tienda y en ventas cargadas a mano), en orden. */
export async function getBestSellers(limit = 8): Promise<PublicProduct[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  // El ranking de ventas no es público: se pide con la clave del servidor.
  const admin = createAdminClient();
  if (!admin) return [];
  const { data: ranking, error } = await admin.rpc("best_sellers", { max_items: limit });
  if (error || !ranking?.length) return [];
  const ids = ranking.map((r) => r.product_id);
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("status", "published").in("id", ids);
  const byId = new Map(((data ?? []) as unknown as PublicProduct[]).map((p) => [p.id, sortImages(p)]));
  return ids.map((id) => byId.get(id)).filter((p): p is PublicProduct => Boolean(p));
}

export const getProductBySlug = cache(async (slug: string): Promise<PublicProduct | null> => {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[catalog] Error al leer producto:", error.message);
    return null;
  }
  return data ? sortImages(data as unknown as PublicProduct) : null;
});

export async function getRelatedProducts(product: PublicProduct, limit = 4) {
  const supabase = createPublicClient();
  if (!supabase || !product.category) return [];
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "published")
    .eq("category_id", product.category.id)
    .neq("id", product.id)
    .order("in_stock", { ascending: false })
    .order("is_featured", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as PublicProduct[]).map(sortImages);
}

/** Categorías visibles que tienen al menos un producto publicado. */
export const getActiveCategories = cache(async (): Promise<PublicCategory[]> => {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const [{ data: categories, error }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, position")
      .eq("is_visible", true)
      .order("position"),
    supabase
      .from("products")
      .select("category_id, stock, is_featured, images:product_images(storage_path, position)")
      .eq("status", "published"),
  ]);
  if (error || !categories) return [];

  const counts = new Map<string, number>();
  const images = new Map<string, { path: string; score: number }>();
  for (const p of products ?? []) {
    if (!p.category_id) continue;
    counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    const path = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path;
    if (!path) continue;
    const score = (p.stock > 0 ? 2 : 0) + (p.is_featured ? 1 : 0);
    const best = images.get(p.category_id);
    if (!best || score > best.score) images.set(p.category_id, { path, score });
  }
  return categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      productCount: counts.get(c.id) ?? 0,
      image: images.get(c.id)?.path ?? null,
    }))
    .filter((c) => c.productCount > 0);
});

export type PublicLine = { name: string; slug: string; productCount: number };

/** Líneas Natura (Chronos, Ekos, Tododia…) que tienen al menos un producto publicado. */
export const getActiveLines = cache(async (): Promise<PublicLine[]> => {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select("line")
    .eq("status", "published")
    .not("line", "is", null);
  if (error || !data) return [];
  const counts = new Map<string, number>();
  for (const p of data) if (p.line) counts.set(p.line, (counts.get(p.line) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, productCount]) => ({ name, slug: slugify(name), productCount }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
});

export const getCategoryBySlug = cache(async (slug: string) => {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("is_visible", true)
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export type CartProductSnapshot = Pick<
  ProductRow,
  "id" | "name" | "slug" | "size" | "magazine_price" | "sale_price" | "stock"
> & { image: string | null };

/** Datos actuales (precio y stock) para validar un carrito. Siempre desde la base, sin caché. */
export async function getProductsForCart(ids: string[]): Promise<CartProductSnapshot[] | null> {
  const supabase = createPublicClient({ cached: false });
  if (!supabase) return null;
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, size, magazine_price, sale_price, stock, images:product_images(storage_path, position)",
    )
    .eq("status", "published")
    .in("id", ids)
    .abortSignal(AbortSignal.timeout(10_000));
  if (error) {
    console.error("[cart] Error al validar carrito:", error.message);
    return null;
  }
  return (data ?? []).map((row) => {
    const images = [...(row.images ?? [])].sort((a, b) => a.position - b.position);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      size: row.size,
      magazine_price: row.magazine_price,
      sale_price: row.sale_price,
      stock: row.stock,
      image: images[0]?.storage_path ?? null,
    };
  });
}

export type ActiveCampaign = { title: string; slug: string; message: string | null; endsOn: string; productIds: string[] };

/** La fecha especial activa hoy (la base solo muestra las activas), o null. */
export async function getActiveCampaign(): Promise<ActiveCampaign | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("campaigns")
    .select("title, slug, message, ends_on, product_ids")
    .order("ends_on", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { title: data.title, slug: data.slug, message: data.message, endsOn: data.ends_on, productIds: data.product_ids };
}

/** Una fecha especial activa por su dirección, o null si no existe o ya terminó. */
export async function getCampaignBySlug(slug: string): Promise<ActiveCampaign | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("campaigns")
    .select("title, slug, message, ends_on, product_ids")
    .eq("slug", slug)
    .maybeSingle();
  return data ? { title: data.title, slug: data.slug, message: data.message, endsOn: data.ends_on, productIds: data.product_ids } : null;
}

/** Productos publicados de una lista (con stock primero, en el orden elegido). */
export async function getProductsByIds(ids: string[]): Promise<PublicProduct[]> {
  const supabase = createPublicClient();
  if (!supabase || ids.length === 0) return [];
  const { data } = await supabase.from("products").select(PRODUCT_SELECT).eq("status", "published").in("id", ids.slice(0, 200));
  const byId = new Map(((data ?? []) as unknown as PublicProduct[]).map((p) => [p.id, sortImages(p)]));
  const list = ids.map((id) => byId.get(id)).filter((p): p is PublicProduct => Boolean(p));
  return [...list.filter((p) => p.stock > 0), ...list.filter((p) => p.stock <= 0)];
}

export type PublicReview = { id: string; name: string; rating: number; comment: string | null; reply: string | null; createdAt: string; photo: string | null };
export type ReviewSummary = { count: number; average: number; latest: PublicReview[] };

/** Reseñas de clientas: promedio de estrellas, cantidad y las últimas (primero las que tienen comentario). */
export async function getReviewSummary(limit = 12): Promise<ReviewSummary | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("id, name, rating, comment, reply, created_at, photo_path")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error || !data || data.length === 0) return null;
  const average = data.reduce((s, r) => s + r.rating, 0) / data.length;
  const latest = [...data.filter((r) => r.comment), ...data.filter((r) => !r.comment)]
    .slice(0, limit)
    .map((r) => ({ id: r.id, name: r.name, rating: r.rating, comment: r.comment, reply: r.reply, createdAt: r.created_at, photo: r.photo_path }));
  return { count: data.length, average, latest };
}
