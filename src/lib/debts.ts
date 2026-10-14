import { toCents } from "./pricing";

export type DebtOrderRow = {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone: string | null;
  total: number | string;
  amount_paid: number | string;
  created_at: string;
  payment_note: string | null;
  payment_method: string;
  payment_status: string | null;
  status: string;
};

export type DebtOrder = { id: string; code: string; owedCents: number; createdAt: string; note: string | null };

export type CustomerDebt = {
  key: string;
  name: string | null;
  phone: string | null;
  owedCents: number;
  since: string;
  orders: DebtOrder[];
};

/** Lo que queda por cobrar de un pedido (0 si está pagado, cancelado o lo cobra Mercado Pago). */
export function owedCents(o: DebtOrderRow): number {
  if (o.status === "cancelled" || o.payment_method === "mercadopago" || o.payment_status === "approved") return 0;
  return Math.max(toCents(o.total) - toCents(o.amount_paid), 0);
}

const normalizeName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Agrupa por clienta lo que falta cobrar. Se agrupa por nombre (sin importar tildes ni mayúsculas);
 * los pedidos sin nombre van cada uno por separado. Ordena de mayor deuda a menor.
 */
export function groupDebts(rows: DebtOrderRow[]): CustomerDebt[] {
  const groups = new Map<string, CustomerDebt>();
  for (const o of rows) {
    const owed = owedCents(o);
    if (owed <= 0) continue;
    const name = o.customer_name?.trim() || null;
    const key = name ? `n:${normalizeName(name)}` : `o:${o.id}`;
    const g = groups.get(key) ?? { key, name, phone: null, owedCents: 0, since: o.created_at, orders: [] };
    g.owedCents += owed;
    if (o.created_at < g.since) g.since = o.created_at;
    g.phone ??= o.customer_phone;
    g.orders.push({ id: o.id, code: o.code, owedCents: owed, createdAt: o.created_at, note: o.payment_note });
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, orders: g.orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
    .sort((a, b) => b.owedCents - a.owedCents);
}

/**
 * Teléfono de Argentina para wa.me: acepta "11 2345-6789", "011 15 2345 6789", "+54 9 11…".
 * Devuelve solo dígitos con 549 adelante, o null si no parece válido.
 */
export function toWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("549")) return d.length >= 12 && d.length <= 13 ? d : null;
  if (d.startsWith("54")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  // Quita el "15" de celulares escritos a la antigua: código de área (2 a 4 dígitos) + 15 + número.
  const old = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (old && old[1].length + old[2].length === 10) d = old[1] + old[2];
  return d.length === 10 ? `549${d}` : null;
}
