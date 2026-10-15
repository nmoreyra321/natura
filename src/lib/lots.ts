/**
 * Vencimientos por lote. En los envases de Natura figura mes y año ("01/29"):
 * se considera que el producto vence el último día de ese mes.
 */

import { localDay } from "./sales";

/** Cuántos meses antes del vencimiento un lote entra en la lista "Por vencer". */
export const EXPIRY_WARNING_MONTHS = 3;

/**
 * Convierte "01/29", "1/29", "01-2029", "0129" o "012029" en la fecha de vencimiento
 * (último día del mes, formato AAAA-MM-DD). Devuelve null si no es válida.
 */
export function parseExpiry(input: string): string | null {
  const digits = input.trim().replace(/[\s/.\-]+/g, "/");
  let m: RegExpMatchArray | null = digits.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) m = input.trim().match(/^(\d{2})(\d{2}|\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** "0129" → "01/29" mientras se escribe. */
export function maskExpiry(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** "2029-01-31" → "01/29", como figura en el envase. */
export function formatExpiry(date: string): string {
  return `${date.slice(5, 7)}/${date.slice(2, 4)}`;
}

/** Fecha límite (AAAA-MM-DD) para la lista "Por vencer": hoy + 3 meses, en hora de Argentina. */
export function expiryWarningLimit(now = new Date()): string {
  const today = localDay(now.toISOString());
  const [y, m, d] = today.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + EXPIRY_WARNING_MONTHS, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export type ExpiryState = "expired" | "soon" | "ok";

export function expiryState(expiresOn: string, now = new Date()): ExpiryState {
  const today = localDay(now.toISOString());
  if (expiresOn < today) return "expired";
  if (expiresOn <= expiryWarningLimit(now)) return "soon";
  return "ok";
}

/** Meses enteros que faltan (0 si vence este mes). */
export function monthsLeft(expiresOn: string, now = new Date()): number {
  const today = localDay(now.toISOString());
  return (Number(expiresOn.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(expiresOn.slice(5, 7)) - Number(today.slice(5, 7));
}
