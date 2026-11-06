/** Armado de la planilla para cargar productos en Mercado Libre (funciones puras, sin acceso a la base). */

export const ML_TITLE_MAX = 60;

/** Título de hasta 60 letras que incluya la marca; si hay que acortarlo, se corta en una palabra entera. */
export function mlTitle(name: string, brand = "Natura"): { title: string; shortened: boolean } {
  const clean = name.replace(/\s+/g, " ").trim();
  const hasBrand = new RegExp(`\\b${brand}\\b`, "i").test(clean);
  const full = hasBrand ? clean : `${clean} ${brand}`;
  if (full.length <= ML_TITLE_MAX) return { title: full, shortened: false };
  // Se acorta el nombre (en una palabra entera) y la marca queda al final.
  const room = hasBrand ? ML_TITLE_MAX : ML_TITLE_MAX - brand.length - 1;
  const head = clean.slice(0, room + 1);
  const cutAt = head.lastIndexOf(" ");
  const base = (cutAt > room * 0.6 ? head.slice(0, cutAt) : clean.slice(0, room)).replace(/[\s,.\-–|]+$/, "");
  return { title: hasBrand ? base : `${base} ${brand}`, shortened: true };
}

/**
 * Precio para Mercado Libre: el que hace falta para que, después de descontar la comisión, te quede tu precio.
 * Se divide por (1 − comisión): con 15% de comisión no alcanza con sumarle 15% (queda por debajo). Redondea hacia arriba a $10.
 */
export function mlPrice(salePrice: number, commissionPercent: number): number {
  const fee = Math.min(Math.max(commissionPercent, 0), 60) / 100;
  return Math.ceil(salePrice / (1 - fee) / 10 - 1e-9) * 10;
}

/** Descripción en texto simple (Mercado Libre no admite formato ni enlaces ni datos de contacto). */
export function mlDescription(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 5000);
}

/** Cosas para revisar a mano antes de publicar (queda escrito en la última columna). */
export function mlIssues(input: { shortened: boolean; photos: string[]; description: string; naturaSku: string | null }): string {
  const issues: string[] = [];
  if (input.shortened) issues.push("Título acortado a 60 letras: revisalo");
  if (input.photos.length === 0) issues.push("Sin fotos (Mercado Libre las exige)");
  if (input.photos.some((u) => /\.(avif|webp)(\?|$)/i.test(u))) issues.push("Alguna foto está en WebP/AVIF: pasala a JPG si no la acepta");
  if (input.description.length < 20) issues.push("Descripción corta o vacía");
  if (!input.naturaSku) issues.push("Sin código de Natura (sirve para encontrarlo en el catálogo de Mercado Libre)");
  return issues.join(" · ");
}
