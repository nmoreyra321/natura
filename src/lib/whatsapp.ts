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

/**
 * Arma el mensaje de pedido, en tono formal. Usa el código del pedido (al azar), nunca el número
 * correlativo, para no mostrar cuántas ventas hay. Deja claro que queda pendiente de confirmación.
 */
export function buildOrderMessage(
  lines: OrderLine[],
  siteUrl?: string,
  extra: {
    orderCode?: string | null;
    customerName?: string | null;
    paymentMethod?: "efectivo" | "transferencia" | "mercadopago";
    /** true si ya se pagó online (mensaje desde la página del pedido). */
    paid?: boolean;
    /** true si la clienta ya transfirió y subió el comprobante en la tienda. */
    transferReported?: boolean;
    /** Página donde la clienta sigue su pedido. */
    trackUrl?: string | null;
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
    "Hola, Natu Mariel.",
    name
      ? `Mi nombre es ${name} y quisiera realizar el siguiente pedido:`
      : "Quisiera realizar el siguiente pedido:",
    ...(extra.orderCode ? [`*Código de pedido: ${extra.orderCode}*`] : []),
    "",
    ...rows,
    "",
    `*Total: ${formatARS(totalCents)}*`,
  ];
  if (savingsCents > 0) {
    parts.push(`Ahorro respecto del precio de revista: ${formatARS(savingsCents)}`);
  }
  if (extra.paid) {
    parts.push(
      "",
      "El pago ya fue realizado mediante Mercado Pago.",
      "Quedo a la espera para coordinar la entrega. Muchas gracias.",
    );
  } else {
    if (extra.paymentMethod) {
      const label = {
        efectivo: "Efectivo",
        transferencia: extra.transferReported
          ? "Transferencia. Ya hice la transferencia y cargué el comprobante en la tienda."
          : "Transferencia",
        mercadopago: "Mercado Pago",
      };
      parts.push("", `Forma de pago: ${label[extra.paymentMethod]}`);
    }
    parts.push("", "Quedo a la espera de la confirmación de disponibilidad y de la coordinación de la entrega. Muchas gracias.");
  }
  if (extra.trackUrl) parts.push("", `Estado del pedido: ${extra.trackUrl}`);
  else if (siteUrl) parts.push("", `Pedido realizado en ${siteUrl.replace(/^https?:\/\//, "")}`);
  return parts.join("\n");
}

export function buildProductInquiryMessage(name: string, url: string): string {
  return `¡Hola Mariel! Quiero consultar por este producto: ${name}\n${url}`;
}
