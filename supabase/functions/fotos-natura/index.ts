// Trae las fotos de un producto desde su ficha en naturacosmeticos.com.ar y las guarda en la tienda.
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

  const room = Math.min(MAX_NEW, MAX_IMAGES_PER_PRODUCT - own.length);
  const wanted = ficha.images.slice(0, Math.max(room, 0));
  if (wanted.length === 0) return json({ status: ficha.images.length === 0 ? "no_images" : "full", sku });

  // Mismas fotos que ya tiene: no se hace nada.
  const current = fromNatura.map((i) => i.source_url).join("\n");
  if (current === wanted.join("\n")) return json({ status: "same", sku });

  // 1) Se bajan y guardan las fotos nuevas.
  const added: { id: string; path: string }[] = [];
  for (const [n, url] of wanted.entries()) {
    try {
      const img = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] }, signal: AbortSignal.timeout(20_000) });
      const type = (img.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext = IMAGE_TYPES[type];
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (!img.ok || !ext || bytes.byteLength > 5_000_000) continue;
      const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
      if (up.error) continue;
      const { data: row, error } = await supabase
        .from("product_images")
        .insert({
          product_id: productId,
          storage_path: path,
          alt: (ficha.name ?? product.name).slice(0, 200),
          position: 60 + n,
          source_url: url,
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

  // 2) Se borran las fotos de Natura anteriores (las propias quedan).
  if (fromNatura.length > 0) {
    await supabase.from("product_images").delete().in("id", fromNatura.map((i) => i.id));
    await supabase.storage.from(BUCKET).remove(fromNatura.map((i) => i.storage_path));
  }

  // 3) Orden: primero las de Natura, después las propias.
  const order = [...added.map((a) => a.id), ...own.map((i) => i.id)];
  for (const [position, id] of order.entries()) {
    await supabase.from("product_images").update({ position }).eq("id", id);
  }

  // Si el producto no tenía código de Natura, se le guarda (sirve para actualizar precios).
  if (!product.natura_sku) await supabase.from("products").update({ natura_sku: sku }).eq("id", productId);

  return json({ status: "ok", added: added.length, replaced: fromNatura.length, sku, name: ficha.name, magazinePrice: ficha.magazinePrice });
});
