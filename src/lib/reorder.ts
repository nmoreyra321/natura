/** Cálculo de "Qué pedirle a Natura" a partir de las ventas recientes y el stock. */

/** Días de ventas que se miran para calcular el ritmo (unos 3 meses). */
export const SALES_WINDOW_DAYS = 90;

export type ReorderInput = {
  id: string;
  name: string;
  stock: number;
  /** Unidades vendidas en los días que se miran. */
  sold: number;
};

export type ReorderSuggestion = ReorderInput & {
  /** Unidades que hacen falta para las semanas elegidas (número entero). */
  need: number;
  /** Cuántas pedir: lo que hace falta menos lo que ya hay. */
  order: number;
};

/** Cuántos días de ventas se miran: desde la primera venta (tienda nueva), mínimo 7 y máximo 90. */
export function salesDays(historyDays = SALES_WINDOW_DAYS): number {
  return Math.min(SALES_WINDOW_DAYS, Math.max(7, historyDays));
}

/**
 * Sugiere cuántas unidades pedir para que alcance `coverDays` días, al mismo ritmo que se vendió.
 * Ej.: vendiste 4 en 14 días y querés 28 días → hacen falta 8; si tenés 3, pedí 5.
 * Devuelve solo lo que conviene pedir, lo que ya no tiene stock primero.
 */
export function suggestReorder(items: ReorderInput[], coverDays = 30, historyDays = SALES_WINDOW_DAYS): ReorderSuggestion[] {
  const days = salesDays(historyDays);
  const out: ReorderSuggestion[] = [];
  for (const it of items) {
    if (it.sold <= 0) continue;
    const need = Math.ceil((it.sold * coverDays) / days);
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

/** "los últimos 3 meses" o "los últimos 12 días". */
export function salesPeriodText(days: number): string {
  return days >= SALES_WINDOW_DAYS ? "los últimos 3 meses" : `los últimos ${days} días`;
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
