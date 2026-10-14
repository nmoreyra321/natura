// Trae la foto de un producto desde su ficha en naturacosmeticos.com.ar y la guarda en la tienda.
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
  const sku = skuFrom(String(body.ref ?? "").slice(0, 300));
  if (!UUID.test(productId)) return json({ status: "error", message: "Producto inválido." });
  if (!sku) return json({ status: "bad_ref" });

  const { data: product } = await supabase.from("products").select("id, name, natura_sku").eq("id", productId).maybeSingle();
  if (!product) return json({ status: "error", message: "El producto no existe." });

  let res: Response;
  try {
    res = await fetch(`${NATURA}/p/p/${sku}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  } catch {
    return json({ status: "error", message: "Natura no respondió." });
  }
  if (res.status === 404) return json({ status: "not_found", sku });
  if (res.status === 403) return json({ status: "blocked" });
  if (!res.ok) return json({ status: "error", message: `Natura respondió ${res.status}` });
  const ficha = parseFicha(await res.text());
  if (!ficha) return json({ status: "not_found", sku });
  if (ficha.images.length === 0) return json({ status: "no_images", sku, name: ficha.name });

  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const room = Math.min(MAX_NEW, MAX_IMAGES_PER_PRODUCT - (count ?? 0));
  if (room <= 0) return json({ status: "full" });

  let added = 0;
  for (const url of ficha.images.slice(0, room)) {
    try {
      const img = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] }, signal: AbortSignal.timeout(20_000) });
      const type = (img.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext = IMAGE_TYPES[type];
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (!img.ok || !ext || bytes.byteLength > 5_000_000) continue;
      const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
      if (up.error) continue;
      const { error } = await supabase
        .from("product_images")
        .insert({ product_id: productId, storage_path: path, alt: (ficha.name ?? product.name).slice(0, 200), position: (count ?? 0) + added });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        continue;
      }
      added++;
    } catch {
      // Una foto que no se pudo bajar no frena las demás.
    }
  }

  // Si el producto no tenía código de Natura, se le guarda (sirve para actualizar precios).
  if (added > 0 && !product.natura_sku) {
    await supabase.from("products").update({ natura_sku: sku }).eq("id", productId);
  }
  return json({ status: added > 0 ? "ok" : "error", added, sku, name: ficha.name, magazinePrice: ficha.magazinePrice, message: added ? undefined : "No pudimos bajar las fotos." });
});
