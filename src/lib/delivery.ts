/**
 * Puntos de encuentro: estaciones del tren Roca (más que nada los sábados). Se muestran en la ficha
 * del producto, el carrito y Cómo comprar. El envío a domicilio va aparte (tabla shipping_zones).
 */
export const DELIVERY_POINTS = ["Glew", "Burzaco", "Lomas de Zamora", "Lanús"] as const;

/** «Glew, Burzaco, Lomas de Zamora y Lanús». */
export const DELIVERY_TEXT = `${DELIVERY_POINTS.slice(0, -1).join(", ")} y ${DELIVERY_POINTS.at(-1)}`;

/** Localidad con envío a domicilio y su precio (en centavos). */
export type ShippingZoneOption = { id: string; name: string; priceCents: number };
