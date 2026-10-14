/**
 * Cálculo de precios y descuentos.
 * Se trabaja en centavos (enteros) para evitar errores de redondeo con decimales.
 */

export type PriceInfo = {
  /** Precio especial Natu Mariel en centavos. */
  saleCents: number;
  /** Precio de revista en centavos. */
  magazineCents: number;
  /** true solo si el precio especial es menor que el de revista. */
  hasDiscount: boolean;
  /** Ahorro en centavos (0 si no hay descuento). */
  savingsCents: number;
  /** Porcentaje de descuento redondeado hacia abajo (0 si no hay descuento). */
  discountPercent: number;
};

/** Convierte un importe en pesos (número o string decimal) a centavos. */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return NaN;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function isValidPrice(value: number | string | null | undefined): boolean {
  const cents = toCents(value);
  return Number.isFinite(cents) && cents > 0;
}

/**
 * descuento = ((precioRevista - precioVenta) / precioRevista) × 100
 * - Ambos precios deben ser positivos; si no, no hay descuento.
 * - No se divide por cero.
 * - Si los precios son iguales o la venta es mayor, no se muestra descuento.
 */
export function getPriceInfo(
  magazinePrice: number | string,
  salePrice: number | string,
): PriceInfo {
  const magazineCents = toCents(magazinePrice);
  const saleCents = toCents(salePrice);

  const valid =
    Number.isFinite(magazineCents) &&
    Number.isFinite(saleCents) &&
    magazineCents > 0 &&
    saleCents > 0;

  if (!valid || saleCents >= magazineCents) {
    return {
      saleCents: Number.isFinite(saleCents) ? saleCents : 0,
      magazineCents: Number.isFinite(magazineCents) ? magazineCents : 0,
      hasDiscount: false,
      savingsCents: 0,
      discountPercent: 0,
    };
  }

  const savingsCents = magazineCents - saleCents;
  // Redondeo hacia abajo: nunca prometer más descuento del real.
  const discountPercent = Math.floor((savingsCents * 100) / magazineCents);

  return {
    saleCents,
    magazineCents,
    hasDiscount: true,
    savingsCents,
    discountPercent,
  };
}

/**
 * Cómo queda un producto cuando cambia el precio de revista de Natura:
 * - si el precio especial era igual al de revista, acompaña el cambio;
 * - si era distinto (un precio propio), se mantiene;
 * - si estaba en oferta y el especial ya no es menor que el de revista, deja de ser oferta.
 */
export function planMagazinePriceUpdate(
  product: { magazine_price: number | string; sale_price: number | string; is_offer: boolean },
  newMagazinePrice: number,
): { magazine_price: number; sale_price: number; is_offer: boolean } {
  const oldMagazine = toCents(product.magazine_price);
  const oldSale = toCents(product.sale_price);
  const newMagazine = toCents(newMagazinePrice);
  const sale = oldSale === oldMagazine ? newMagazine : oldSale;
  return {
    magazine_price: newMagazine / 100,
    sale_price: sale / 100,
    is_offer: product.is_offer && sale < newMagazine,
  };
}

/**
 * Precio especial a partir de un % de descuento sobre el precio de revista.
 * Se redondea hacia abajo al peso entero, así el descuento que ve la clienta
 * nunca queda por debajo del elegido (ej.: $27.990 con 25% → $20.992, 25%).
 */
export function salePriceFromDiscount(magazinePrice: number | string, percent: number): number {
  const magazineCents = toCents(magazinePrice);
  if (!Number.isFinite(magazineCents) || magazineCents <= 0) return NaN;
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) return NaN;
  if (percent === 0) return magazineCents / 100;
  const pesos = Math.floor((magazineCents * (100 - percent)) / 100 / 100);
  return Math.max(pesos, 1);
}

/** Recargo en centavos por pagar con Mercado Pago (redondeado al peso). */
export function surchargeCents(totalCents: number, percent: number): number {
  if (!Number.isFinite(totalCents) || totalCents <= 0 || !Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((totalCents * percent) / 100 / 100) * 100;
}
