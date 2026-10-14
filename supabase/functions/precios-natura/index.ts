// Consulta el precio de revista vigente en naturacosmeticos.com.ar.
// Corre en Supabase porque Natura rechaza los pedidos que salen de los servidores de Vercel.
// Solo la pueden usar administradoras con sesión iniciada (se verifica el token y is_admin()).
// El lector de la página es el mismo que src/lib/natura.ts (mantener ambos iguales).
import { createClient } from "npm:@supabase/supabase-js@2";

const NATURA = "https://www.naturacosmeticos.com.ar";
const SKU = /^NATARG-\d{1,12}$/;
const MAX_SKUS = 20;
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

type Lookup =
  | { status: "ok"; magazinePrice: number }
  | { status: "not_found" }
  | { status: "blocked" }
  | { status: "error"; message: string };

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

function parseMagazinePrice(html: string): number | null {
  const text = flightText(html);
  const at = text.indexOf('"initialData":{"productId"');
  if (at < 0) return null;
  try {
    const data = readJsonObject(text, at + '"initialData":'.length) as {
      price?: { list?: { value?: number } | null; sales?: { value?: number } | null };
    } | null;
    const value = data?.price?.list?.value || data?.price?.sales?.value;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

async function lookup(sku: string): Promise<Lookup> {
  try {
    const res = await fetch(`${NATURA}/p/p/${sku}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) return { status: "not_found" };
    if (res.status === 403) return { status: "blocked" };
    if (!res.ok) return { status: "error", message: `Natura respondió ${res.status}` };
    const price = parseMagazinePrice(await res.text());
    return price ? { status: "ok", magazinePrice: price } : { status: "not_found" };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
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
  const skus = [...new Set(Array.isArray(body.skus) ? body.skus : [])]
    .filter((s): s is string => typeof s === "string" && SKU.test(s))
    .slice(0, MAX_SKUS);

  const results: Record<string, Lookup> = {};
  const queue = [...skus];
  // De a 4 consultas a la vez, para no saturar el sitio de Natura.
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let sku = queue.shift(); sku; sku = queue.shift()) results[sku] = await lookup(sku);
    }),
  );
  return json({ results });
});
