import { formatARS } from "./format";

/**
 * Integración de WhatsApp preparada.
 * El número se configura con NEXT_PUBLIC_WHATSAPP_NUMBER (dato público, no secreto),
 * en formato internacional solo con dígitos. Ej. Argentina celular: 549 + característica + número.
 * Mientras no esté configurado, no se generan enlaces.
 */

/** Normaliza y valida un número para wa.me. Devuelve null si no es válido. */
export function normalizeWhatsAppNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  // E.164: hasta 15 dígitos. Exigimos al menos 10 para evitar números incompletos.
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.startsWith("0")) return null;
  return digits;
}

export function getWhatsAppNumber(): string | null {
  return normalizeWhatsAppNumber(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
}

export function buildWhatsAppUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export type OrderLine = {
  name: string;
  size?: string | null;
  quantity: number;
  unitCents: number;
  magazineUnitCents: number;
};

export function getOrderTotals(lines: OrderLine[]) {
  let totalCents = 0;
  let savingsCents = 0;
  let units = 0;
  for (const line of lines) {
    totalCents += line.unitCents * line.quantity;
    if (line.magazineUnitCents > line.unitCents) {
      savingsCents += (line.magazineUnitCents - line.unitCents) * line.quantity;
    }
    units += line.quantity;
  }
  return { totalCents, savingsCents, units };
}

/** Arma el mensaje de pedido. Deja claro que queda pendiente de confirmación. */
export function buildOrderMessage(
  lines: OrderLine[],
  siteUrl?: string,
  extra: {
    orderNumber?: number | null;
    customerName?: string | null;
    paymentMethod?: "efectivo" | "mercadopago";
    /** true si ya se pagó online (mensaje desde la página del pedido). */
    paid?: boolean;
  } = {},
): string {
  const { totalCents, savingsCents } = getOrderTotals(lines);
  const rows = lines.map((line, i) => {
    const name = line.size ? `${line.name} (${line.size})` : line.name;
    const subtotal = formatARS(line.unitCents * line.quantity);
    return `${i + 1}. ${name}\n   ${line.quantity} x ${formatARS(line.unitCents)} = ${subtotal}`;
  });

  const name = extra.customerName?.trim();
  const parts = [
    name ? `¡Hola Mariel! Soy ${name} y quiero hacer este pedido:` : "¡Hola Mariel! Quiero hacer este pedido:",
    ...(extra.orderNumber ? [`*Pedido N.º ${extra.orderNumber}*`] : []),
    "",
    ...rows,
    "",
    `*Total: ${formatARS(totalCents)}*`,
  ];
  if (savingsCents > 0) {
    parts.push(`Ahorro frente a precio de revista: ${formatARS(savingsCents)}`);
  }
  if (extra.paid) {
    parts.push("", "✅ Ya lo pagué con Mercado Pago. Quedo a la espera para coordinar la entrega. ¡Gracias!");
  } else {
    if (extra.paymentMethod) {
      parts.push("", `Forma de pago: ${extra.paymentMethod === "mercadopago" ? "Mercado Pago" : "Efectivo"}`);
    }
    parts.push("", "Quedo a la espera de tu confirmación de stock, pago y entrega. ¡Gracias!");
  }
  if (siteUrl) parts.push(`(Pedido armado en ${siteUrl})`);
  return parts.join("\n");
}

export function buildProductInquiryMessage(name: string, url: string): string {
  return `¡Hola Mariel! Quiero consultar por este producto: ${name}\n${url}`;
}
