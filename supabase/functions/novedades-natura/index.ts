// Busca productos de Natura que todavía no están en la tienda y los agrega.
//  - { mode: "buscar" }: lee la lista pública de productos de Natura (sitemap.xml) y devuelve los códigos
//    que no están en la tienda ni se revisaron antes.
//  - { mode: "agregar", sku }: lee la ficha de ese código y, si es un producto nuevo con precio, lo crea
//    (publicado, sin stock, con su categoría, línea, precio de revista y fotos).
// Corre en Supabase porque Natura rechaza los pedidos que salen de los servidores de Vercel.
// Solo la pueden usar administradoras con sesión iniciada: todo se hace con su sesión (RLS).
import { createClient } from "npm:@supabase/supabase-js@2";

const NATURA = "https://www.naturacosmeticos.com.ar";
const BUCKET = "product-images";
const SKU = /^NATARG-\d{1,12}$/;
const MAX_IMAGES = 3;
const RECHECK_DAYS = 7;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* ------------------------- Lector de la ficha ------------------------- */

function flightText(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)<\/script>/g;
  let out = "";
  for (const m of html.matchAll(re)) {
    try {
      out += JSON.parse(`"${m[1]}"`) as string;
    } catch {
      // Fragmento ilegible: se ignora.
    }
  }
  return out;
}

function readJsonObject(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  return null;
}

/** Los textos largos vienen aparte ("$2f"): se buscan en el resto de la página. */
function resolveRef(text: string, bytes: Uint8Array, value: unknown): string {
  if (typeof value !== "string") return "";
  if (!/^\$[0-9a-f]+$/.test(value)) return value;
  const m = new RegExp(`(?:^|\\n)${value.slice(1)}:T([0-9a-f]+),`).exec(text);
  if (!m) return "";
  const start = new TextEncoder().encode(text.slice(0, m.index + m[0].length)).length;
  return new TextDecoder().decode(bytes.slice(start, start + parseInt(m[1], 16)));
}

function htmlToText(html: string): string {
  if (!html) return "";
  const plain = html
    .replace(/<\/(li|p|h\d|div)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return plain
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim().replace(/^[•\-·]\s*/, "• "))
    .filter(Boolean)
    .join("\n");
}

type Variation = { productId?: string; orderable?: boolean | null; sharedColorDescription?: string; sharedColor?: string; friendlyName?: string; bannerImage?: string };
type Ficha = {
  sku: string;
  name: string;
  friendlyName: string | null;
  brand: string | null;
  productLine: string | null;
  magazinePrice: number | null;
  images: string[];
  variations: Variation[];
  description: string;
};

function parseFicha(html: string): Ficha | null {
  const text = flightText(html);
  const at = text.indexOf('"initialData":{"productId"');
  if (at < 0) return null;
  const d = readJsonObject(text, at + '"initialData":'.length) as Record<string, unknown> | null;
  if (!d) return null;
  const bytes = new TextEncoder().encode(text);
  const str = (v: unknown) => resolveRef(text, bytes, v).trim();
  const price = d.price as { list?: { value?: number } | null; sales?: { value?: number } | null } | undefined;
  const value = price?.list?.value || price?.sales?.value;
  const long = htmlToText(str(d.longDescription)) || htmlToText(str(d.description));
  const short = htmlToText(str(d.description));
  const description = short && !long.includes(short) ? `${short}\n\n${long}` : long;
  const variations = Array.isArray(d.variations) ? (d.variations as Variation[]).filter((v) => v && typeof v === "object") : [];
  return {
    sku: String(d.productId ?? ""),
    name: str(d.name),
    friendlyName: str(d.friendlyName) || null,
    brand: typeof d.brand === "string" ? d.brand : null,
    productLine: typeof d.productLine === "string" ? d.productLine : null,
    magazinePrice: typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null,
    images: (Array.isArray(d.images) ? d.images : []).filter((u): u is string => typeof u === "string" && u.startsWith("https://")),
    variations,
    description,
  };
}

/* ------------------------- Datos de la tienda ------------------------- */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function slugify(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120).replace(/-+$/g, "");
}

function sizeOf(...names: (string | null | undefined)[]): string | null {
  const re = /(\d+(?:[.,]\d+)?)\s?(ml|mg|g|gr|kg|l|un|u|unidades)\b/gi;
  for (const s of names) {
    if (!s) continue;
    const all = [...s.matchAll(re)];
    if (all.length > 0) {
      const [, n, u] = all[all.length - 1];
      const unit = ({ gr: "g", u: "un", unidades: "un" } as Record<string, string>)[u.toLowerCase()] ?? u.toLowerCase();
      return `${n} ${unit}`;
    }
  }
  return null;
}

function guessGender(name: string): "femenino" | "masculino" | null {
  if (/(masculin|homem|hombre)/i.test(name)) return "masculino";
  if (/(femenin|mujer)/i.test(name)) return "femenino";
  return null;
}

type Training = { bySlug: Map<string, string>; lines: string[]; rows: { tokens: Set<string>; cat: string }[] };
let trainingCache: { at: number; value: Training } | null = null;

const tokensOf = (name: string, line: string | null) => {
  const t = new Set([...norm(name).matchAll(/[a-z]{3,}/g)].map((m) => m[0]));
  if (line) t.add("L_" + norm(line).replace(/\s+/g, "_"));
  return t;
};

// deno-lint-ignore no-explicit-any
async function training(supabase: any): Promise<Training> {
  if (trainingCache && Date.now() - trainingCache.at < 5 * 60_000) return trainingCache.value;
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from("categories").select("id, slug"),
    supabase.from("products").select("name, line, category_id").limit(5000),
  ]);
  const bySlug = new Map<string, string>((cats ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]));
  const lines = [...new Set((prods ?? []).map((p: { line: string | null }) => p.line).filter(Boolean))] as string[];
  const rows = (prods ?? [])
    .filter((p: { category_id: string | null }) => p.category_id)
    .map((p: { name: string; line: string | null; category_id: string }) => ({ tokens: tokensOf(p.name, p.line), cat: p.category_id }));
  const value = { bySlug, lines, rows };
  trainingCache = { at: Date.now(), value };
  return value;
}

const has = (rx: RegExp, s: string) => rx.test(s);

/** Categoría por el tipo de producto (reglas) y, si no alcanza, por parecido con los productos que ya hay. */
function categoryFor(name: string, line: string | null, t: Training): string | null {
  const n = norm(name);
  const l = norm(line ?? "");
  const head = n.split(" ")[0] ?? "";
  const pick = (slug: string) => t.bySlug.get(slug) ?? null;
  let slug: string | null = null;
  if (has(/\b(accesorio|llavero|pulsera|bolsa|bolso|neceser|caja de regalo|espejo|valvula)\b/, n) && !has(/\bregalo madres\b/, n)) slug = "accesorios";
  else if (has(/\b(regalo|kit|kits|set|estuche|coleccion|presente|duo|combo|\d+ productos)\b/, n) && head !== "labial") slug = "kits";
  else if (has(/\b(infantil|infantiles|bebe|bebes|ninos|meninos|kids|mm&bb|toallitas)\b/, n) || l === "nature" || l === "mama y bebe") slug = "infantiles";
  else if (has(/\brepuesto\b/, n) && has(/\bdifusor\b/, n)) slug = "perfumeria";
  else if (has(/\bbalsamo labial\b/, n)) slug = "rostro";
  else if (l === "natura solar" || (has(/\b(protector solar|bronceador|after sun|repelente)\b/, n) && !has(/\b(facial|aclarador)\b/, n))) slug = "proteccion-solar";
  else if (has(/(multiprotector|protector.*(facial|aclarador)|antisenales|desmaquillante|mascarilla|agua micelar|limpiador|limpieza|serum facial|tonico facial|contorno de ojos|pre make up|bruma facial|jabon en polvo|jabon facial|chronos|facial)/, n) && l !== "lumina") slug = "rostro";
  else if (
    (["labial", "gloss", "delineador", "lapiz", "sombra", "sombras", "rubor", "polvo", "corrector", "esmalte", "esmaltes", "iluminador", "pincel", "mascara", "base", "paleta", "primer", "tinta", "kajal"].includes(head) ||
      has(/\b(labial|gloss|top coat|pestanas|cejas|bb cream|cc cream)\b/, n)) &&
    !has(/\b(hidratante corporal|jabon|capilar)\b/, n)
  ) slug = "maquillajes";
  else if (has(/\b(post afeitado|afeitar|afeitado|barba|aftershave|after shave)\b/, n)) slug = "hombre";
  else if (has(/\b(eau de parfum|eau de toilette|deo parfum|parfum|colonia|body splash|perfume|difusor|bruma corporal|fragancia|edt|edp)\b/, n)) slug = "perfumeria";
  else if (has(/\b(shampoo|champu|acondicionador|capilar|peinar|cabello|anticaida|protector termico|crema para peinar|ampolla|leave in|leave-in|finalizador)\b/, n) || l === "lumina") slug = "cabello";
  else if (l === "homem" || l === "sr. n") slug = "hombre";
  else if (has(/\b(jabon|jabones|corporal|cuerpo|manos|pies|desodorante|crema nutritiva|ducha|bano|exfoliante|locion|nectar|body|hidratante|aceite bifasico|aceite)\b/, n)) slug = "cuerpo-y-bano";
  else if (l === "una" || l === "faces") slug = "maquillajes";
  if (slug) return pick(slug);

  // Sin regla clara: se parece más a la categoría de productos con palabras parecidas.
  const tokens = tokensOf(name, line);
  const counts = new Map<string, number>();
  const words = new Map<string, Map<string, number>>();
  for (const r of t.rows) {
    counts.set(r.cat, (counts.get(r.cat) ?? 0) + 1);
    const w = words.get(r.cat) ?? new Map<string, number>();
    for (const tok of r.tokens) w.set(tok, (w.get(tok) ?? 0) + 1);
    words.set(r.cat, w);
  }
  const total = t.rows.length;
  let best: { score: number; cat: string } | null = null;
  for (const [cat, c] of counts) {
    let score = Math.log(c / total);
    for (const tok of tokens) score += Math.log(((words.get(cat)?.get(tok) ?? 0) + 0.5) / (c + 1));
    if (!best || score > best.score) best = { score, cat };
  }
  return best?.cat ?? null;
}

function lineFor(ficha: Ficha, name: string, t: Training): string | null {
  const candidates = [ficha.productLine, ficha.brand].filter(Boolean).map((s) => norm(s as string));
  for (const line of t.lines) {
    const nl = norm(line);
    if (candidates.includes(nl)) return line;
  }
  const n = norm(name);
  for (const line of [...t.lines].sort((a, b) => b.length - a.length)) {
    if (n.includes(norm(line))) return line;
  }
  return null;
}

/* ------------------------- Modo «buscar» ------------------------- */

// deno-lint-ignore no-explicit-any
async function buscar(supabase: any): Promise<Response> {
  let xml: string;
  try {
    const res = await fetch(`${NATURA}/sitemap.xml`, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
    if (res.status === 403) return json({ status: "blocked" });
    if (!res.ok) return json({ status: "error", message: `Natura respondió ${res.status}` });
    xml = await res.text();
  } catch {
    return json({ status: "error", message: "Natura no respondió." });
  }
  const all = [...new Set([...xml.matchAll(/\/p\/[^<\s]*?\/(NATARG-\d+)</g)].map((m) => m[1]))].filter((s) => SKU.test(s));
  if (all.length === 0) return json({ status: "error", message: "No pudimos leer la lista de Natura." });

  const [{ data: mine }, { data: seen }] = await Promise.all([
    supabase.from("products").select("natura_sku").not("natura_sku", "is", null).limit(10000),
    supabase.from("natura_skus_vistos").select("sku, status, seen_at").limit(20000),
  ]);
  const have = new Set((mine ?? []).map((p: { natura_sku: string }) => p.natura_sku));
  const skip = new Set<string>();
  const cutoff = Date.now() - RECHECK_DAYS * 86_400_000;
  for (const s of seen ?? []) {
    const fresh = new Date(s.seen_at).getTime() > cutoff;
    if (s.status === "agregado" || s.status === "variante" || fresh) skip.add(s.sku);
  }
  const pending = all.filter((sku) => !have.has(sku) && !skip.has(sku));
  return json({ status: "ok", total: all.length, have: have.size, pending });
}

/* ------------------------- Modo «agregar» ------------------------- */

type Outcome = { status: "agregado" | "variante" | "sin_precio" | "no_disponible" | "ya_estaba" | "blocked" | "error"; id?: string; name?: string; category?: string | null; message?: string; preview?: unknown };

// deno-lint-ignore no-explicit-any
async function remember(supabase: any, dry: boolean, sku: string, status: string, productId: string | null, name: string | null) {
  // En el simulacro no se anota «agregado» (no se creó nada); lo demás sí, para no volver a mirar fichas muertas.
  if (dry && status === "agregado") return;
  await supabase.from("natura_skus_vistos").upsert({ sku, status, product_id: productId, name: name?.slice(0, 200) ?? null, seen_at: new Date().toISOString() });
}

// deno-lint-ignore no-explicit-any
async function agregar(supabase: any, sku: string, dry = false): Promise<Outcome> {
  const { data: existing } = await supabase.from("products").select("id, name").eq("natura_sku", sku).maybeSingle();
  if (existing) return { status: "ya_estaba", id: existing.id, name: existing.name };

  let res: Response;
  try {
    res = await fetch(`${NATURA}/p/p/${sku}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  } catch {
    return { status: "error", message: "Natura no respondió." };
  }
  if (res.status === 404) {
    await remember(supabase, dry, sku, "no_disponible", null, null);
    return { status: "no_disponible" };
  }
  if (res.status === 403) return { status: "blocked" };
  if (!res.ok) return { status: "error", message: `Natura respondió ${res.status}` };
  const ficha = parseFicha(await res.text());
  if (!ficha) {
    await remember(supabase, dry, sku, "no_disponible", null, null);
    return { status: "no_disponible" };
  }

  const name = (ficha.friendlyName || ficha.variations.find((v) => v.friendlyName)?.friendlyName || ficha.name).replace(/\s+/g, " ").trim().slice(0, 120);
  if (name.length < 2) return { status: "error", message: "La ficha no tiene nombre." };

  // ¿Es otro tono o tamaño de un producto que ya está? Entonces no se crea de nuevo.
  const variationIds = [...new Set(ficha.variations.map((v) => v.productId).filter((id): id is string => !!id && SKU.test(id)))].filter((id) => id !== sku);
  if (variationIds.length > 0) {
    const { data: parent } = await supabase.from("products").select("id, name").in("natura_sku", variationIds).limit(1).maybeSingle();
    if (parent) {
      await remember(supabase, dry, sku, "variante", parent.id, name);
      return { status: "variante", id: parent.id, name: parent.name };
    }
  }

  // ¿Ya hay un producto con el mismo nombre? Entonces es el mismo producto cargado con otro código.
  const { data: sameName } = await supabase.from("products").select("id, name").ilike("name", name.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
  if (sameName) {
    await remember(supabase, dry, sku, "variante", sameName.id, name);
    return { status: "variante", id: sameName.id, name: sameName.name };
  }

  if (!ficha.magazinePrice) {
    await remember(supabase, dry, sku, "sin_precio", null, name);
    return { status: "sin_precio", name };
  }

  const t = await training(supabase);
  const line = lineFor(ficha, name, t);
  const categoryId = categoryFor(name, line, t);
  const shades = ficha.variations
    .filter((v) => v.orderable !== false)
    .map((v) => v.sharedColorDescription || v.sharedColor)
    .filter((s): s is string => !!s);
  let description = ficha.description;
  if (shades.length > 0) description = `${description}\n\nTonos disponibles: ${[...new Set(shades)].join(", ")}`.trim();

  const slugOfCat = [...t.bySlug.entries()].find(([, id]) => id === categoryId)?.[0] ?? null;
  if (dry) {
    return {
      status: "agregado",
      name,
      category: slugOfCat,
      preview: { sku, line, size: sizeOf(name, ficha.name), price: ficha.magazinePrice, images: ficha.images.length, variations: variationIds.length, gender: guessGender(name), desc: description.slice(0, 80) },
    };
  }

  let slug = slugify(name) || "producto";
  const { data: clash } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${sku.replace(/\D/g, "").replace(/^0+/, "")}`.slice(0, 140);

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name,
      slug,
      description: description.slice(0, 5000),
      category_id: categoryId,
      size: sizeOf(name, ficha.name),
      magazine_price: ficha.magazinePrice,
      sale_price: ficha.magazinePrice, // la categoría le pone su descuento guardado (si tiene)
      stock: 0,
      status: "published",
      natura_sku: sku,
      line,
      gender: guessGender(name),
    })
    .select("id")
    .single();
  if (error || !created) return { status: "error", message: error?.message ?? "No se pudo crear." };

  // Fotos: hasta 3 de la ficha (o la del primer tono).
  const urls = ficha.images.length > 0 ? ficha.images : ficha.variations.map((v) => v.bannerImage).filter((u): u is string => typeof u === "string" && u.startsWith("https://")).slice(0, 1);
  let position = 0;
  for (const url of urls.slice(0, MAX_IMAGES)) {
    try {
      const img = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] }, signal: AbortSignal.timeout(20_000) });
      const type = (img.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext = IMAGE_TYPES[type];
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (!img.ok || !ext || bytes.byteLength > 5_000_000) continue;
      const path = `products/${created.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
      if (up.error) continue;
      const { error: imgError } = await supabase
        .from("product_images")
        .insert({ product_id: created.id, storage_path: path, alt: name.slice(0, 200), position, source_url: url });
      if (imgError) {
        await supabase.storage.from(BUCKET).remove([path]);
        continue;
      }
      position++;
    } catch {
      // Una foto que no se pudo bajar no frena el resto.
    }
  }

  // Si en el mismo rato otra consulta creó el mismo producto (otro tono), se queda el más antiguo.
  if (variationIds.length > 0) {
    const { data: twins } = await supabase.from("products").select("id, created_at").in("natura_sku", [sku, ...variationIds]).order("created_at").order("id");
    if ((twins ?? []).length > 1 && twins[0].id !== created.id) {
      const { data: imgs } = await supabase.from("product_images").select("storage_path").eq("product_id", created.id);
      await supabase.from("products").delete().eq("id", created.id);
      if ((imgs ?? []).length > 0) await supabase.storage.from(BUCKET).remove(imgs.map((i: { storage_path: string }) => i.storage_path));
      await remember(supabase, dry, sku, "variante", twins[0].id, name);
      return { status: "variante", id: twins[0].id };
    }
  }

  await remember(supabase, dry, sku, "agregado", created.id, name);
  const slugOf = [...t.bySlug.entries()].find(([, id]) => id === categoryId)?.[0] ?? null;
  return { status: "agregado", id: created.id, name, category: slugOf };
}

/* ------------------------- Fichas que Natura ya no tiene ------------------------- */

const SMALL = new Set(["de", "del", "la", "el", "los", "las", "y", "para", "con", "en", "a", "o", "al", "por", "sin", "un", "una"]);

/** «kaiak-noite-eau-de-parfum-100-ml» → «Kaiak Noite Eau de Parfum 100 ml». */
function nameFromSlug(slug: string): string {
  let text = slug;
  try {
    text = decodeURIComponent(slug);
  } catch {
    // Se usa tal cual.
  }
  return text
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => (/\d/.test(w) || (i > 0 && SMALL.has(w)) || w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .slice(0, 120);
}

/** Productos que figuran en la lista de Natura pero cuya ficha ya no existe, y que la tienda no tiene. */
// deno-lint-ignore no-explicit-any
async function muertos(supabase: any): Promise<Response> {
  let xml: string;
  try {
    const res = await fetch(`${NATURA}/sitemap.xml`, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
    if (res.status === 403) return json({ status: "blocked" });
    if (!res.ok) return json({ status: "error", message: `Natura respondi\u00f3 ${res.status}` });
    xml = await res.text();
  } catch {
    return json({ status: "error", message: "Natura no respondi\u00f3." });
  }
  const slugs = new Map<string, string>();
  for (const m of xml.matchAll(/\/p\/([^<\s/]+)\/(NATARG-\d+)</g)) if (!slugs.has(m[2])) slugs.set(m[2], m[1]);
  const [{ data: mine }, { data: seen }] = await Promise.all([
    supabase.from("products").select("natura_sku, name").limit(10000),
    supabase.from("natura_skus_vistos").select("sku").eq("status", "no_disponible").limit(20000),
  ]);
  const have = new Set((mine ?? []).map((p: { natura_sku: string | null }) => p.natura_sku).filter(Boolean));
  const names = new Set((mine ?? []).map((p: { name: string }) => norm(p.name)));
  const items: { sku: string; name: string }[] = [];
  const seenNames = new Set<string>();
  for (const { sku } of seen ?? []) {
    const slug = slugs.get(sku);
    if (!slug || have.has(sku)) continue;
    const name = nameFromSlug(slug);
    const key = norm(name);
    if (name.length < 2 || names.has(key) || seenNames.has(key)) continue;
    seenNames.add(key);
    items.push({ sku, name });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return json({ status: "ok", items });
}

/** Crea a mano un producto de una ficha que ya no existe: el nombre y el precio los pone la administradora. */
// deno-lint-ignore no-explicit-any
async function crearManual(supabase: any, sku: string, rawName: unknown, rawPrice: unknown): Promise<Outcome> {
  const name = String(rawName ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  // Sin precio: queda como borrador con un precio provisorio de $1; el precio se pide recién al cargarle stock.
  const noPrice = rawPrice === null || rawPrice === undefined || rawPrice === "";
  const price = noPrice ? 1 : Number(rawPrice);
  if (name.length < 2) return { status: "error", message: "Escrib\u00ed el nombre del producto." };
  if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) return { status: "error", message: "Revis\u00e1 el precio de revista." };

  const { data: existing } = await supabase.from("products").select("id, name").eq("natura_sku", sku).maybeSingle();
  if (existing) return { status: "ya_estaba", id: existing.id, name: existing.name };

  const t = await training(supabase);
  const line = lineFor({ sku, name, friendlyName: name, brand: null, productLine: null, magazinePrice: price, images: [], variations: [], description: "" }, name, t);
  const categoryId = categoryFor(name, line, t);
  let slug = slugify(name) || "producto";
  const { data: clash } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${sku.replace(/\D/g, "").replace(/^0+/, "")}`.slice(0, 140);

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name,
      slug,
      description: "",
      category_id: categoryId,
      size: sizeOf(name),
      magazine_price: price,
      sale_price: price, // la categor\u00eda le pone su descuento guardado (si tiene)
      stock: 0,
      status: noPrice ? "draft" : "published",
      natura_sku: sku,
      line,
      gender: guessGender(name),
    })
    .select("id")
    .single();
  if (error || !created) return { status: "error", message: error?.message ?? "No se pudo crear." };
  await remember(supabase, false, sku, "agregado", created.id, name);
  const slugOf = [...t.bySlug.entries()].find(([, id]) => id === categoryId)?.[0] ?? null;
  return { status: "agregado", id: created.id, name, category: slugOf };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body.mode === "buscar") return await buscar(supabase);
  if (body.mode === "agregar") {
    const sku = String(body.sku ?? "");
    if (!SKU.test(sku)) return json({ status: "error", message: "Código inválido." });
    return json(await agregar(supabase, sku));
  }
  if (body.mode === "muertos") return await muertos(supabase);
  if (body.mode === "crear") {
    const sku = String(body.sku ?? "");
    if (!SKU.test(sku)) return json({ status: "error", message: "C\u00f3digo inv\u00e1lido." });
    return json(await crearManual(supabase, sku, body.name, body.price));
  }
  if (body.mode === "simular") {
    // Simulacro: hace todo menos escribir (sirve para probar sin crear nada).
    const sku = String(body.sku ?? "");
    if (!SKU.test(sku)) return json({ status: "error", message: "Código inválido." });
    return json(await agregar(supabase, sku, true));
  }
  return json({ error: "mode" }, 400);
});
