/** De dónde vino cada venta (columna orders.channel). */

export const MANUAL_CHANNEL_LABELS: Record<string, string> = {
  facebook: "Vivo de Facebook",
  presencial: "En persona",
  whatsapp: "WhatsApp",
  otro: "Otro",
};

/** true si la venta la cargó la administradora con «Venta rápida». */
export function isManualSale(channel: string | null | undefined): boolean {
  return Boolean(channel && channel !== "web");
}

/** "Tienda web" o "Venta rápida · Vivo de Facebook". */
export function originLabel(channel: string | null | undefined): string {
  if (!isManualSale(channel)) return "Tienda web";
  return `Venta rápida · ${MANUAL_CHANNEL_LABELS[channel as string] ?? "Otro"}`;
}

/** Texto de búsqueda seguro para filtros (sin caracteres especiales de la base). */
export function cleanSearch(q: string | null | undefined): string {
  return String(q ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
