// Trae las fotos de un producto desde su ficha en naturacosmeticos.com.ar y las guarda en la tienda.
// Si la ficha ya no existe o no tiene fotos (productos que Natura dejó de vender), busca la foto que
// Natura sigue teniendo guardada con ese código, primero en Argentina y después en otros países.
// Reemplaza solo las fotos que vinieron de Natura (product_images.source_url no nulo); las que
// subió la administradora (source_url nulo) nunca se tocan. Si las fotos de Natura no cambiaron,
// no hace nada.
// Corre en Supabase porque Natura rechaza los pedidos que salen de los servidores de Vercel.
// Solo la pueden usar administradoras con sesión iniciada: todo se hace con su sesión (RLS).
import { createClient } from "npm:@supabase/supabase-js@2";

const NATURA = "https://www.naturacosmeticos.com.ar";
const BUCKET = "product-images";
const MAX_IMAGES_PER_PRODUCT = 8;
const MAX_NEW = 3;
const UUID = /^[0-9a-f-]{36}$/;
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

/* ------------------------- Fotos guardadas de Natura (sin ficha) ------------------------- */

const CDN = "https://production.na01.natura.com/dw/image/v2/BFKR_PRD/on/demandware.static/-";
/** Argentina primero; después otros países de Natura (mismo número de producto). */
const COUNTRIES: { cc: string; prefix: string }[] = [
  { cc: "ar", prefix: "NATARG" },
  { cc: "cl", prefix: "NATCHL" },
  { cc: "pe", prefix: "NATPER" },
  { cc: "co", prefix: "NATCOL" },
  { cc: "mx", prefix: "NATMEX" },
  { cc: "br", prefix: "NATBRA" },
];
const cdnUrl = (cc: string, code: string, n: number) =>
  `${CDN}/Sites-natura-${cc}-storefront-catalog/default/dw00000000/PRODUTOS/${code}_${n}.jpg?sw=1000`;

type Fetched = { bytes: Uint8Array<ArrayBuffer>; type: string; ext: string };

async function fetchImage(url: string): Promise<Fetched | null> {
  try {
    const img = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] }, signal: AbortSignal.timeout(15_000) });
    const type = (img.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = IMAGE_TYPES[type];
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (!img.ok || !ext || bytes.byteLength > 5_000_000) return null;
    return { bytes, type, ext };
  } catch {
    return null;
  }
}

const hashOf = async (b: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", b)), (x) => x.toString(16).padStart(2, "0")).join("");

/** Lo que devuelve Natura para un código que no existe (por si en vez de error manda una foto genérica). */
const placeholderCache = new Map<string, Promise<string | null>>();
function placeholderHash(cc: string, prefix: string): Promise<string | null> {
  if (!placeholderCache.has(cc)) {
    placeholderCache.set(
      cc,
      fetchImage(cdnUrl(cc, `${prefix}-999999990`, 1)).then((f) => (f ? hashOf(f.bytes) : null)),
    );
  }
  return placeholderCache.get(cc)!;
}

/** Una foto real (no la genérica de «sin foto» ni una casi vacía). */
async function realImage(url: string, cc: string, prefix: string): Promise<Fetched | null> {
  const f = await fetchImage(url);
  if (!f || f.bytes.byteLength < 3000) return null;
  const ph = await placeholderHash(cc, prefix);
  if (ph && ph === (await hashOf(f.bytes))) return null;
  return f;
}

/** Busca hasta `max` fotos guardadas para el código, país por país. */
async function storedPhotos(sku: string, max: number): Promise<{ from: string; photos: { url: string; f: Fetched }[] } | null> {
  const digits = sku.replace(/\D/g, "");
  if (!digits || max <= 0) return null;
  for (const { cc, prefix } of COUNTRIES) {
    const code = `${prefix}-${digits}`;
    const firstUrl = cdnUrl(cc, code, 1);
    const first = await realImage(firstUrl, cc, prefix);
    if (!first) continue;
    const photos = [{ url: firstUrl, f: first }];
    for (let n = 2; n <= max; n++) {
      const url = cdnUrl(cc, code, n);
      const f = await realImage(url, cc, prefix);
      if (!f) break;
      photos.push({ url, f });
    }
    return { from: cc, photos };
  }
  return null;
}

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

type Ficha = { name: string | null; magazinePrice: number | null; images: string[] };

function parseFicha(html: string): Ficha | null {
  const text = flightText(html);
  const at = text.indexOf('"initialData":{"productId"');
  if (at < 0) return null;
  try {
    const d = readJsonObject(text, at + '"initialData":'.length) as {
      friendlyName?: string;
      name?: string;
      images?: unknown[];
      price?: { list?: { value?: number } | null; sales?: { value?: number } | null };
    } | null;
    if (!d) return null;
    const plain = (s?: string) => (typeof s === "string" && !/^\$[0-9a-f]+$/.test(s) ? s.trim() : null);
    const value = d.price?.list?.value || d.price?.sales?.value;
    return {
      name: plain(d.friendlyName) ?? plain(d.name),
      magazinePrice: typeof value === "number" && value > 0 ? value : null,
      images: (d.images ?? []).filter((u): u is string => typeof u === "string" && u.startsWith("https://")),
    };
  } catch {
    return null;
  }
}

/** "72197", "NATARG-72197" o un enlace de la ficha → "NATARG-72197". */
function skuFrom(ref: string): string | null {
  const fromLink = ref.match(/NATARG-(\d{2,12})/i);
  if (fromLink) return `NATARG-${fromLink[1]}`;
  const digits = ref.replace(/\D/g, "");
  return digits.length >= 2 && digits.length <= 12 ? `NATARG-${digits}` : null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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
  const productId = String(body.productId ?? "");
  // En la actualización general no se agregan fotos de Natura a productos que solo tienen fotos propias.
  const skipOwn = body.skipOwn === true;
  if (!UUID.test(productId)) return json({ status: "error", message: "Producto inválido." });

  const { data: product } = await supabase.from("products").select("id, name, natura_sku").eq("id", productId).maybeSingle();
  if (!product) return json({ status: "error", message: "El producto no existe." });
  const ref = String(body.ref ?? "").slice(0, 300).trim();
  const sku = ref ? skuFrom(ref) : product.natura_sku;
  if (!sku) return json({ status: ref ? "bad_ref" : "no_code" });

  const { data: existing } = await supabase
    .from("product_images")
    .select("id, storage_path, source_url, position")
    .eq("product_id", productId)
    .order("position");
  const own = (existing ?? []).filter((i) => !i.source_url);
  const fromNatura = (existing ?? []).filter((i) => i.source_url);
  if (skipOwn && own.length > 0 && fromNatura.length === 0) return json({ status: "own_photos" });

  const room = Math.max(Math.min(MAX_NEW, MAX_IMAGES_PER_PRODUCT - own.length), 0);

  // 1) La ficha de Natura Argentina.
  let ficha: Ficha | null = null;
  let fichaStatus: "ok" | "not_found" | "blocked" | "error" = "ok";
  let fichaMessage = "";
  try {
    const res = await fetch(`${NATURA}/p/p/${sku}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) fichaStatus = "not_found";
    else if (res.status === 403) fichaStatus = "blocked";
    else if (!res.ok) {
      fichaStatus = "error";
      fichaMessage = `Natura respondió ${res.status}`;
    } else {
      ficha = parseFicha(await res.text());
      if (!ficha) fichaStatus = "not_found";
    }
  } catch {
    fichaStatus = "error";
    fichaMessage = "Natura no respondió.";
  }

  let from = "ficha";
  let downloads: { url: string; f: Fetched | null }[] = [];
  if (ficha && ficha.images.length > 0) {
    const wanted = ficha.images.slice(0, room);
    if (wanted.length === 0) return json({ status: "full", sku });
    // Mismas fotos que ya tiene: no se hace nada.
    if (fromNatura.map((i) => i.source_url).join("\n") === wanted.join("\n")) return json({ status: "same", sku });
    downloads = wanted.map((url) => ({ url, f: null }));
  } else {
    // 2) Sin ficha o sin fotos: la foto guardada de Natura con ese código. Solo si el producto no tiene
    //    fotos de Natura (no se cambia una foto buena por una adivinada).
    if (fromNatura.length > 0) {
      // Si la pidió a mano con un código, se avisa que no está (puede haberse equivocado de código).
      if (ref) return json({ status: ficha ? "no_images" : "not_found", sku });
      return json({ status: "same", sku });
    }
    if (room === 0) return json({ status: "full", sku });
    const stored = await storedPhotos(sku, room);
    if (!stored) {
      if (fichaStatus === "blocked") return json({ status: "blocked" });
      if (fichaStatus === "error") return json({ status: "error", message: fichaMessage });
      return json({ status: ficha ? "no_images" : "not_found", sku });
    }
    from = stored.from;
    downloads = stored.photos;
  }

  // 3) Se bajan y guardan las fotos nuevas.
  const added: { id: string; path: string }[] = [];
  for (const [n, d] of downloads.entries()) {
    try {
      const f = d.f ?? (await fetchImage(d.url));
      if (!f) continue;
      const path = `products/${productId}/${crypto.randomUUID()}.${f.ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f.bytes, { contentType: f.type, upsert: false });
      if (up.error) continue;
      const { data: row, error } = await supabase
        .from("product_images")
        .insert({
          product_id: productId,
          storage_path: path,
          alt: (ficha?.name ?? product.name).slice(0, 200),
          position: 60 + n,
          source_url: d.url,
        })
        .select("id")
        .single();
      if (error || !row) {
        await supabase.storage.from(BUCKET).remove([path]);
        continue;
      }
      added.push({ id: row.id, path });
    } catch {
      // Una foto que no se pudo bajar no frena las demás.
    }
  }
  if (added.length === 0) return json({ status: "error", message: "No pudimos bajar las fotos de Natura." });

  // 4) Se borran las fotos de Natura anteriores (las propias quedan).
  if (fromNatura.length > 0) {
    await supabase.from("product_images").delete().in("id", fromNatura.map((i) => i.id));
    await supabase.storage.from(BUCKET).remove(fromNatura.map((i) => i.storage_path));
  }

  // 5) Orden: primero las de Natura, después las propias.
  const order = [...added.map((a) => a.id), ...own.map((i) => i.id)];
  for (const [position, id] of order.entries()) {
    await supabase.from("product_images").update({ position }).eq("id", id);
  }

  // Si el producto no tenía código de Natura, se le guarda (sirve para actualizar precios).
  if (!product.natura_sku) await supabase.from("products").update({ natura_sku: sku }).eq("id", productId);

  return json({
    status: "ok",
    added: added.length,
    replaced: fromNatura.length,
    sku,
    name: ficha?.name ?? null,
    magazinePrice: ficha?.magazinePrice ?? null,
    // De dónde salió: «ficha» (ficha actual), «ar» (foto guardada de Argentina) u otro país («cl», «br»…).
    from,
    images: added,
  });
});
