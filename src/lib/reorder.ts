/**
 * Cálculo de "Qué pedirle a Natura": se mira cuánto se vendió (hasta 3 meses, o desde la primera
 * venta si la tienda es nueva), se saca el ritmo por semana y se multiplica por las semanas elegidas.
 * Ej.: 4 por semana → para 1 semana necesitás 4, para 2 semanas 8, para 8 semanas 32.
 */

/** Días de ventas que se miran como máximo (unos 3 meses). */
export const SALES_WINDOW_DAYS = 90;

export type ReorderInput = {
  id: string;
  name: string;
  stock: number;
  /** Unidades vendidas en los días que se miran. */
  sold: number;
};

export type ReorderSuggestion = ReorderInput & {
  /** Unidades que hacen falta para las semanas elegidas (número entero, redondeado para arriba). */
  need: number;
  /** Cuántas pedir: lo que hace falta menos lo que ya hay. */
  order: number;
};

/** Días que se usan de base: desde la primera venta, mínimo 7 (una semana) y máximo 90. */
export function salesDays(historyDays = SALES_WINDOW_DAYS): number {
  return Math.min(SALES_WINDOW_DAYS, Math.max(7, historyDays));
}

/**
 * Sugiere cuántas unidades pedir para que alcancen `weeks` semanas, al mismo ritmo que se vendió.
 * Devuelve solo lo que conviene pedir, lo que ya no tiene stock primero.
 */
export function suggestReorder(items: ReorderInput[], weeks: number, historyDays = SALES_WINDOW_DAYS): ReorderSuggestion[] {
  const days = salesDays(historyDays);
  const out: ReorderSuggestion[] = [];
  for (const it of items) {
    if (it.sold <= 0) continue;
    const need = Math.ceil((it.sold * weeks * 7) / days);
    const order = need - Math.max(0, it.stock);
    if (order <= 0) continue;
    out.push({ ...it, need, order });
  }
  // Primero lo que se agotó, después lo que menos alcanza, después lo que más se vende.
  return out.sort(
    (a, b) =>
      Number(b.stock <= 0) - Number(a.stock <= 0) ||
      a.stock / a.need - b.stock / b.need ||
      b.sold - a.sold ||
      a.name.localeCompare(b.name, "es"),
  );
}

/** "la última semana", "los últimos 12 días" o "los últimos 3 meses". */
export function salesPeriodText(days: number): string {
  if (days >= SALES_WINDOW_DAYS) return "los últimos 3 meses";
  if (days === 7) return "la última semana";
  if (days % 7 === 0) return `las últimas ${days / 7} semanas`;
  return `los últimos ${days} días`;
}

/** Texto para copiar y pegar al hacer el pedido (WhatsApp, notas). */
export function reorderText(list: { name: string; order: number; sku: string | null }[]): string {
  const lines = list.map((r) => `• ${r.order} × ${r.name}${r.sku ? ` (cód. ${r.sku.replace("NATARG-", "")})` : ""}`);
  return ["Pedido Natura:", ...lines].join("\n");
}

/** Cuántos días de ventas hay desde la primera venta (para no subestimar con una tienda nueva). */
export function historyDays(firstSaleIso: string | null, now = new Date()): number {
  if (!firstSaleIso) return SALES_WINDOW_DAYS;
  return Math.ceil((now.getTime() - new Date(firstSaleIso).getTime()) / 86_400_000);
}

/** Desde qué fecha se cuentan las ventas (ISO). */
export function salesWindowStart(now = new Date()): string {
  return new Date(now.getTime() - SALES_WINDOW_DAYS * 86_400_000).toISOString();
}
