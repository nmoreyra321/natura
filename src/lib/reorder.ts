/** Cálculo de "Qué pedir en el próximo pedido" a partir de las ventas recientes. */

/** Días de ventas que se miran para calcular el ritmo (unos 3 meses). */
export const SALES_WINDOW_DAYS = 90;

export type ReorderInput = {
  id: string;
  name: string;
  stock: number;
  /** Unidades vendidas en los últimos SALES_WINDOW_DAYS días. */
  sold: number;
  /** Clientas anotadas en "Avisame cuando vuelva" que todavía esperan. */
  waiting: number;
};

export type ReorderSuggestion = ReorderInput & {
  /** Unidades que se venden por mes, aproximado. */
  perMonth: number;
  /** Días que alcanza el stock actual al ritmo de venta (null si no se vende). */
  daysLeft: number | null;
  /** Cuántas pedir. */
  order: number;
};

/**
 * Sugiere cuántas unidades pedir para cubrir `coverDays` días de ventas.
 * Si hay clientas esperando, por lo menos se pide para ellas.
 * Devuelve solo lo que conviene pedir, lo más urgente primero.
 */
export function suggestReorder(items: ReorderInput[], coverDays = 30): ReorderSuggestion[] {
  const out: ReorderSuggestion[] = [];
  for (const it of items) {
    const perDay = it.sold / SALES_WINDOW_DAYS;
    const target = Math.ceil(perDay * coverDays);
    const forSales = Math.max(0, target - it.stock);
    const forWaiting = Math.max(0, it.waiting - it.stock);
    const order = Math.max(forSales, forWaiting);
    if (order <= 0) continue;
    out.push({
      ...it,
      perMonth: Math.round(perDay * 30 * 10) / 10,
      daysLeft: perDay > 0 ? Math.floor(it.stock / perDay) : null,
      order,
    });
  }
  return out.sort(
    (a, b) =>
      (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || b.waiting - a.waiting || b.perMonth - a.perMonth || a.name.localeCompare(b.name, "es"),
  );
}

/** Texto para copiar y pegar al hacer el pedido (WhatsApp, notas). */
export function reorderText(list: { name: string; order: number; sku: string | null }[]): string {
  const lines = list.map((r) => `• ${r.order} × ${r.name}${r.sku ? ` (cód. ${r.sku.replace("NATARG-", "")})` : ""}`);
  return ["Pedido Natura:", ...lines].join("\n");
}

/** Desde qué fecha se cuentan las ventas (ISO). */
export function salesWindowStart(now = new Date()): string {
  return new Date(now.getTime() - SALES_WINDOW_DAYS * 86_400_000).toISOString();
}
