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

/** Costo fijo por unidad que cobra Mercado Libre según el precio: hasta `upTo` pesos se cobra `fee`. */
export type MlFixedTier = { upTo: number; fee: number };

/**
 * Valores de referencia de Argentina (agosto 2026). Mercado Libre los cambia varias veces al año:
 * en la página de la planilla se pueden corregir.
 */
export const ML_FIXED_TIERS_DEFAULT: MlFixedTier[] = [
  { upTo: 15000, fee: 1115 },
  { upTo: 25000, fee: 2300 },
  { upTo: 33000, fee: 2810 },
];

export type MlCosts = {
  /** Costo fijo por unidad según el precio (por encima del último tramo, no se cobra). */
  fixedTiers?: MlFixedTier[];
  /** Lo que pagás vos de envío por cada venta (si ofrecés envío gratis). */
  shipping?: number;
};

/** Costo fijo que corresponde a un precio de Mercado Libre. */
export function mlFixedFee(price: number, tiers: MlFixedTier[] = []): number {
  const sorted = [...tiers].filter((t) => t.upTo > 0 && t.fee >= 0).sort((a, b) => a.upTo - b.upTo);
  return sorted.find((t) => price < t.upTo)?.fee ?? 0;
}

const up10 = (n: number) => Math.ceil(n / 10 - 1e-9) * 10;

/**
 * Precio para Mercado Libre: el más bajo que, después de descontar la comisión, el costo fijo por unidad
 * y el envío que pagás, te deja al menos tu precio de la tienda. Redondea hacia arriba a $10.
 * Se divide por (1 − comisión): con 15% de comisión no alcanza con sumarle 15% (queda por debajo).
 */
export function mlPrice(salePrice: number, commissionPercent: number, costs: MlCosts = {}): number {
  const fee = Math.min(Math.max(commissionPercent, 0), 60) / 100;
  const shipping = Math.max(costs.shipping ?? 0, 0);
  const tiers = costs.fixedTiers ?? [];
  const net = (p: number) => p * (1 - fee) - mlFixedFee(p, tiers) - shipping;
  // Dentro de cada tramo lo que te queda sube con el precio: el mínimo que alcanza está al principio de un
  // tramo (justo donde baja el costo fijo) o en el precio que cubre ese costo fijo. Se prueban todos.
  const candidates = [
    ...[0, ...tiers.map((t) => Math.max(t.fee, 0))].map((f) => up10((salePrice + shipping + f) / (1 - fee))),
    ...tiers.map((t) => up10(t.upTo)),
  ];
  const ok = candidates.filter((p) => net(p) >= salePrice - 1e-6);
  return ok.length ? Math.min(...ok) : up10((salePrice + shipping + Math.max(0, ...tiers.map((t) => t.fee))) / (1 - fee));
}

/** Lo que te queda de una venta en Mercado Libre, después de comisión, costo fijo y envío. */
export function mlNet(price: number, commissionPercent: number, costs: MlCosts = {}): number {
  const fee = Math.min(Math.max(commissionPercent, 0), 60) / 100;
  return Math.round(price * (1 - fee) - mlFixedFee(price, costs.fixedTiers ?? []) - Math.max(costs.shipping ?? 0, 0));
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
