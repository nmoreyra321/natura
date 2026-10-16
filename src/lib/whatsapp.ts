
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

export function buildProductInquiryMessage(name: string, url: string): string {
  return `¡Hola Mariel! Quiero consultar por este producto: ${name}\n${url}`;
}
