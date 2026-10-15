/** Club de clientas: cada GIFT_EVERY compras confirmadas (por teléfono), un regalo. */

import { toWhatsAppPhone } from "./debts";

export const GIFT_EVERY = 5;

/** Estados de pedido que cuentan como compra. */
export const PURCHASE_STATUSES = ["confirmed", "delivered"] as const;

/** Teléfono con el que se agrupan las compras (549…), o null si no se puede usar. */
export function loyaltyKey(phone: string | null | undefined): string | null {
  return toWhatsAppPhone(phone);
}

export type LoyaltyStatus = {
  purchases: number;
  /** Regalos ganados que todavía no se entregaron. */
  pending: number;
  /** Compras hechas hacia el próximo regalo (0 a GIFT_EVERY − 1). */
  progress: number;
  /** Compras que faltan para el próximo regalo. */
  left: number;
};

export function loyaltyStatus(purchases: number, giftsGiven: number): LoyaltyStatus {
  const earned = Math.floor(purchases / GIFT_EVERY);
  const progress = purchases % GIFT_EVERY;
  return { purchases, pending: Math.max(0, earned - giftsGiven), progress, left: GIFT_EVERY - progress };
}

export type ClubOrder = { customer_name: string | null; customer_phone: string | null; status: string; created_at: string };

export type ClubMember = LoyaltyStatus & { phone: string; name: string; lastAt: string; /** Regalos ya entregados. */ given: number };

/** Agrupa las compras por teléfono. Primero a quién le toca regalo, después quién está más cerca. */
export function summarizeClub(orders: ClubOrder[], gifts: { phone: string }[]): ClubMember[] {
  const given = new Map<string, number>();
  for (const g of gifts) given.set(g.phone, (given.get(g.phone) ?? 0) + 1);

  const byPhone = new Map<string, { name: string; purchases: number; lastAt: string }>();
  for (const o of orders) {
    if (!(PURCHASE_STATUSES as readonly string[]).includes(o.status)) continue;
    const key = loyaltyKey(o.customer_phone);
    if (!key) continue;
    const m = byPhone.get(key) ?? { name: "", purchases: 0, lastAt: "" };
    m.purchases++;
    if (o.created_at > m.lastAt) {
      m.lastAt = o.created_at;
      m.name = o.customer_name?.trim() || m.name;
    } else if (!m.name) {
      m.name = o.customer_name?.trim() || "";
    }
    byPhone.set(key, m);
  }

  return [...byPhone.entries()]
    .map(([phone, m]) => {
      const g = given.get(phone) ?? 0;
      return { phone, name: m.name || "Sin nombre", lastAt: m.lastAt, given: g, ...loyaltyStatus(m.purchases, g) };
    })
    .sort((a, b) => b.pending - a.pending || b.progress - a.progress || b.purchases - a.purchases || a.name.localeCompare(b.name, "es"));
}
