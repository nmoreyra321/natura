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
 * Valores de referencia de Argentina (septiembre 2026, paquetes chicos). Mercado Libre los cambia varias
 * veces al año: en la página de la planilla se pueden corregir.
 */
export const ML_FIXED_TIERS_DEFAULT: MlFixedTier[] = [
  { upTo: 15000, fee: 1330 },
  { upTo: 24000, fee: 2740 },
  { upTo: 33000, fee: 3320 },
];

/** Desde este precio el envío gratis es obligatorio y una parte la paga la vendedora (septiembre 2026). */
export const ML_FREE_SHIPPING_DEFAULT = { from: 33000, cost: 7790 };

export type MlCosts = {
  /** Costo fijo por unidad según el precio (por encima del último tramo, no se cobra). */
  fixedTiers?: MlFixedTier[];
  /** Lo que pagás vos de envío en cada venta, siempre (si ofrecés envío gratis en todo). */
  shipping?: number;
  /** Envío gratis obligatorio: desde `from` pesos, te descuentan `cost` por venta. */
  freeShipping?: { from: number; cost: number };
};

/** Lo que te descuentan de envío según el precio. */
export function mlShippingCost(price: number, costs: MlCosts = {}): number {
  const always = Math.max(costs.shipping ?? 0, 0);
  const fs = costs.freeShipping;
  return always + (fs && fs.cost > 0 && price >= fs.from ? fs.cost : 0);
}

/** Costos de Mercado Libre guardados en la tienda (lo que se usa para la planilla). */
export type MlSettings = {
  commission: number;
  fixedTiers: MlFixedTier[];
  freeShipping: { from: number; cost: number };
  updatedAt: string | null;
};

export const ML_COMMISSION_DEFAULT = 16;

const num = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Lee lo guardado (o los valores de referencia si no hay nada o algo está mal). */
export function parseMlSettings(raw: unknown): MlSettings {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const tiersRaw = Array.isArray(o.fixedTiers) ? o.fixedTiers : null;
  const tiers = tiersRaw
    ?.map((t) => {
      const r = (t ?? {}) as Record<string, unknown>;
      const upTo = num(r.upTo, 1, 100_000_000);
      const fee = num(r.fee, 0, 10_000_000);
      return upTo === null || fee === null ? null : { upTo, fee };
    })
    .filter((t): t is MlFixedTier => !!t)
    .sort((a, b) => a.upTo - b.upTo);
  const fs = (o.freeShipping ?? {}) as Record<string, unknown>;
  return {
    commission: num(o.commission, 0, 60) ?? ML_COMMISSION_DEFAULT,
    fixedTiers: tiers && tiers.length ? tiers : ML_FIXED_TIERS_DEFAULT,
    freeShipping: {
      from: num(fs.from, 0, 100_000_000) ?? ML_FREE_SHIPPING_DEFAULT.from,
      cost: num(fs.cost, 0, 10_000_000) ?? ML_FREE_SHIPPING_DEFAULT.cost,
    },
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

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
  const fsCost = costs.freeShipping && costs.freeShipping.cost > 0 ? costs.freeShipping.cost : 0;
  const net = (p: number) => p * (1 - fee) - mlFixedFee(p, tiers) - mlShippingCost(p, costs);
  // Dentro de cada tramo lo que te queda sube con el precio: el mínimo que alcanza está al principio de un
  // tramo (justo donde baja el costo fijo) o en el precio que cubre ese costo fijo. Se prueban todos.
  const fixedFees = [0, ...tiers.map((t) => Math.max(t.fee, 0))];
  const extras = fixedFees.flatMap((f) => [f, f + fsCost]);
  const candidates = [
    ...extras.map((x) => up10((salePrice + shipping + x) / (1 - fee))),
    ...tiers.map((t) => up10(t.upTo)),
    ...(costs.freeShipping ? [up10(costs.freeShipping.from)] : []),
  ];
  const ok = candidates.filter((p) => net(p) >= salePrice - 1e-6);
  return ok.length ? Math.min(...ok) : up10((salePrice + shipping + Math.max(...extras)) / (1 - fee));
}

/** Lo que te queda de una venta en Mercado Libre, después de comisión, costo fijo y envío. */
export function mlNet(price: number, commissionPercent: number, costs: MlCosts = {}): number {
  const fee = Math.min(Math.max(commissionPercent, 0), 60) / 100;
  return Math.round(price * (1 - fee) - mlFixedFee(price, costs.fixedTiers ?? []) - mlShippingCost(price, costs));
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
