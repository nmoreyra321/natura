const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formato monetario argentino: $ 12.500,00
 * Se normalizan los espacios (Intl usa un espacio duro) para que el texto
 * sea consistente en pantalla y en el mensaje de WhatsApp.
 */
export function formatARS(cents: number): string {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  return arsFormatter.format(value).replace(/\s/g, " ").replace(/^\$(?=\d)/, "$ ");
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormatter.format(d);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
