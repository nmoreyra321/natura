/** Dónde entrega Natu Mariel (zona sur). Se muestra en la ficha del producto, el carrito y Cómo comprar. */
export const DELIVERY_POINTS = ["Lanús", "Lomas de Zamora", "Glew"] as const;

/** «Lanús, Lomas de Zamora y Glew». */
export const DELIVERY_TEXT = `${DELIVERY_POINTS.slice(0, -1).join(", ")} y ${DELIVERY_POINTS.at(-1)}`;
