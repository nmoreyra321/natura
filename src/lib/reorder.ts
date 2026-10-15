/**
 * Cálculo de "Qué pedirle a Natura": se mira lo que se vendió en las últimas N semanas
 * y se supone que en las próximas N semanas se va a vender lo mismo.
 */

export type ReorderInput = {
  id: string;
  name: string;
  stock: number;
  /** Unidades vendidas en las últimas semanas elegidas. */
  sold: number;
};

export type ReorderSuggestion = ReorderInput & {
  /** Unidades que hacen falta para las próximas semanas (lo mismo que se vendió). */
  need: number;
  /** Cuántas pedir: lo que hace falta menos lo que ya hay. */
  order: number;
};

/**
 * Ej.: en las últimas 2 semanas vendiste 4 → para las próximas 2 necesitás 4; si te queda 1, pedí 3.
 * Devuelve solo lo que conviene pedir, lo que ya no tiene stock primero.
 */
export function suggestReorder(items: ReorderInput[]): ReorderSuggestion[] {
  const out: ReorderSuggestion[] = [];
  for (const it of items) {
    if (it.sold <= 0) continue;
    const need = it.sold;
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

/** "la última semana" / "las últimas 2 semanas" (o "próxima"/"próximas"). */
export function weeksText(weeks: number, when: "pasadas" | "proximas"): string {
  if (weeks === 1) return when === "pasadas" ? "la última semana" : "la próxima semana";
  return when === "pasadas" ? `las últimas ${weeks} semanas` : `las próximas ${weeks} semanas`;
}

/** Texto para copiar y pegar al hacer el pedido (WhatsApp, notas). */
export function reorderText(list: { name: string; order: number; sku: string | null }[]): string {
  const lines = list.map((r) => `• ${r.order} × ${r.name}${r.sku ? ` (cód. ${r.sku.replace("NATARG-", "")})` : ""}`);
  return ["Pedido Natura:", ...lines].join("\n");
}

/** Desde qué fecha se cuentan las ventas (ISO). */
export function salesWindowStart(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
