/**
 * Cálculos del panel de ventas. Cuenta como venta un pedido confirmado o entregado;
 * los pendientes se informan aparte y los cancelados no suman.
 * Las fechas se agrupan en hora de Argentina.
 */

import { toCents } from "./pricing";

export const SALES_TIME_ZONE = "America/Argentina/Buenos_Aires";
const SOLD = new Set(["confirmed", "delivered"]);

export type SalesOrder = {
  status: string;
  total: number | string;
  savings: number | string;
  created_at: string;
  items: { product_id: string | null; name: string; quantity: number; unit_price: number | string }[];
};

/** Mes con formato "2026-10". */
export type MonthKey = string;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SALES_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha (AAAA-MM-DD) en hora de Argentina. */
export function localDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

export function parseMonth(value: string | undefined, fallback: MonthKey): MonthKey {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
}

export function currentMonth(now = new Date()): MonthKey {
  return localDay(now.toISOString()).slice(0, 7);
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Inicio del mes en hora de Argentina (UTC−3, sin horario de verano), como instante ISO. */
export function monthStartIso(month: MonthKey): string {
  return new Date(`${month}-01T00:00:00-03:00`).toISOString();
}

const monthNames = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonthNames = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });

export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  const text = monthNames.format(new Date(Date.UTC(y, m - 1, 15)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function shortMonthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return shortMonthNames.format(new Date(Date.UTC(y, m - 1, 15))).replace(".", "");
}

export type MonthSummary = {
  /** Totales en centavos para no acumular errores de redondeo. */
  totalCents: number;
  savingsCents: number;
  orders: number;
  units: number;
  averageCents: number;
  pendingCents: number;
  pendingOrders: number;
  cancelledOrders: number;
  /** Ventas por día del mes (índice 0 = día 1). */
  byDayCents: number[];
  topProducts: { key: string; name: string; units: number; totalCents: number }[];
};

export function summarizeMonth(orders: SalesOrder[], month: MonthKey): MonthSummary {
  const byDayCents = Array.from({ length: daysInMonth(month) }, () => 0);
  const products = new Map<string, { key: string; name: string; units: number; totalCents: number }>();
  const s = { totalCents: 0, savingsCents: 0, orders: 0, units: 0, pendingCents: 0, pendingOrders: 0, cancelledOrders: 0 };

  for (const o of orders) {
    const day = localDay(o.created_at);
    if (!day.startsWith(month)) continue;
    const total = toCents(o.total);
    if (o.status === "pending") {
      s.pendingCents += total;
      s.pendingOrders++;
      continue;
    }
    if (o.status === "cancelled") {
      s.cancelledOrders++;
      continue;
    }
    if (!SOLD.has(o.status)) continue;
    s.totalCents += total;
    s.savingsCents += toCents(o.savings);
    s.orders++;
    byDayCents[Number(day.slice(8, 10)) - 1] += total;
    for (const item of o.items) {
      s.units += item.quantity;
      const key = item.product_id ?? `nombre:${item.name}`;
      const entry = products.get(key) ?? { key, name: item.name, units: 0, totalCents: 0 };
      entry.units += item.quantity;
      entry.totalCents += toCents(item.unit_price) * item.quantity;
      products.set(key, entry);
    }
  }

  return {
    ...s,
    averageCents: s.orders ? Math.round(s.totalCents / s.orders) : 0,
    byDayCents,
    topProducts: [...products.values()]
      .sort((a, b) => b.totalCents - a.totalCents || b.units - a.units || a.name.localeCompare(b.name))
      .slice(0, 10),
  };
}

/** Total vendido por mes, para los últimos `count` meses terminando en `month`. */
export function monthlyTotals(orders: SalesOrder[], month: MonthKey, count = 6) {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1));
  const totals = new Map(months.map((m) => [m, 0]));
  for (const o of orders) {
    if (!SOLD.has(o.status)) continue;
    const m = localDay(o.created_at).slice(0, 7);
    if (totals.has(m)) totals.set(m, totals.get(m)! + toCents(o.total));
  }
  return months.map((m) => ({ month: m, totalCents: totals.get(m)! }));
}

/** Variación porcentual (entera) frente al período anterior; null si no hay base para comparar. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
