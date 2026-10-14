/**
 * Lectura del precio de revista vigente en naturacosmeticos.com.ar.
 * La ficha de cada producto trae sus datos dentro del HTML (formato de React Server Components).
 */

export const NATURA_BASE_URL = "https://www.naturacosmeticos.com.ar";

/** Cabeceras de navegador: sin ellas el sitio de Natura rechaza la consulta. */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

export function naturaProductUrl(sku: string): string {
  // El texto del medio de la URL no importa: Natura identifica el producto por el código final.
  return `${NATURA_BASE_URL}/p/p/${encodeURIComponent(sku)}`;
}

/** Une los fragmentos `self.__next_f.push([1,"..."])` en un solo texto. */
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

/** Extrae el objeto JSON que empieza en `start` contando llaves (respeta textos entre comillas). */
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

type NaturaPrice = { list?: { value?: number } | null; sales?: { value?: number } | null };

/**
 * Precio de revista de la ficha: el precio de lista si el producto está en promoción,
 * o el precio de venta si no tiene descuento. null si la página no trae el dato.
 */
export function parseNaturaMagazinePrice(html: string): number | null {
  const text = flightText(html);
  const marker = '"initialData":{"productId"';
  const at = text.indexOf(marker);
  if (at < 0) return null;
  let data: { price?: NaturaPrice } | null = null;
  try {
    data = readJsonObject(text, at + '"initialData":'.length) as { price?: NaturaPrice } | null;
  } catch {
    return null;
  }
  const price = data?.price;
  const value = price?.list?.value || price?.sales?.value;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export type NaturaLookup =
  | { status: "ok"; magazinePrice: number }
  | { status: "not_found" }
  | { status: "blocked" }
  | { status: "error"; message: string };

/** Consulta la ficha de un producto en Natura. */
export async function fetchNaturaMagazinePrice(sku: string): Promise<NaturaLookup> {
  try {
    const res = await fetch(naturaProductUrl(sku), {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404) return { status: "not_found" };
    if (res.status === 403) return { status: "blocked" };
    if (!res.ok) return { status: "error", message: `Natura respondió ${res.status}` };
    const price = parseNaturaMagazinePrice(await res.text());
    return price ? { status: "ok", magazinePrice: price } : { status: "not_found" };
  } catch (e) {
    return { status: "error", message: (e as Error).message };
  }
}
