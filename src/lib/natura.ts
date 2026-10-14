/**
 * Lectura del precio de revista vigente en naturacosmeticos.com.ar.
 * La ficha de cada producto trae sus datos dentro del HTML (formato de React Server Components).
 *
 * La consulta la hace la función de Supabase `precios-natura` (Natura rechaza los pedidos que
 * salen de Vercel); su copia de este lector tiene que mantenerse igual a la de este archivo.
 */

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
