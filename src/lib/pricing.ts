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
  const discountPercent = Math.floor((savingsCents / magazineCents) * 100);

  return {
    saleCents,
    magazineCents,
    hasDiscount: true,
    savingsCents,
    discountPercent,
  };
}
