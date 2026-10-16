/**
 * Puntos de encuentro: estaciones del tren Roca (más que nada los sábados). Se muestran en la ficha
 * del producto, el carrito y Cómo comprar. El envío a domicilio va aparte (tabla shipping_zones).
 */
export const DELIVERY_POINTS = ["Glew", "Burzaco", "Lomas de Zamora", "Lanús"] as const;

/** «Glew, Burzaco, Lomas de Zamora y Lanús». */
export const DELIVERY_TEXT = `${DELIVERY_POINTS.slice(0, -1).join(", ")} y ${DELIVERY_POINTS.at(-1)}`;

/** Localidad con envío a domicilio y el % de la compra que se cobra por el envío. */
export type ShippingZoneOption = { id: string; name: string; percent: number };

/** Costo del envío: el % de la compra (en centavos), redondeado hacia arriba a $100. */
export function shippingCostCents(productsCents: number, percent: number): number {
  if (!(percent > 0) || !(productsCents > 0)) return 0;
  return Math.ceil((productsCents * percent) / 100 / 10_000) * 10_000;
}
