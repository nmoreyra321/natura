import { surchargeCents, toCents } from "./pricing";

/** Colchón que se le suma al recargo justo, por si la comisión sube un poco. */
export const FEE_MARGIN_PERCENT = 0.5;

/** Recargo que conviene dejar: el justo más el colchón. */
export function recommendedPercent(justPercent: number): number {
  return Math.round((justPercent + FEE_MARGIN_PERCENT) * 10) / 10;
}

export type MpOrder = { total: number | string; mp_net_received: number | string | null };

export type MpFeeSummary = {
  /** Pagos de Mercado Pago del mes que ya informaron cuánto llegó. */
  count: number;
  /** Lo que cobraste de más a las clientas (recargo), en centavos. */
  surchargeCents: number;
  /** Lo que se llevó Mercado Pago de comisión, en centavos. */
  feeCents: number;
  /** Lo que te quedó después de la comisión menos lo que valían los pedidos: + ganaste, − perdiste. */
  resultCents: number;
  /** Cuántos pedidos te dejaron menos de lo que valían. */
  shortCount: number;
  /** Comisión real promedio sobre lo que paga la clienta (%), null si no hay datos. */
  feePercent: number | null;
  /** Recargo justo para no perder (%), redondeado hacia arriba a un decimal, null si no hay datos. */
  suggestedPercent: number | null;
};

/** Resume cuánto cobró Mercado Pago y si el recargo alcanzó. El recargo se calcula con el % actual. */
export function summarizeMpFees(orders: MpOrder[], currentPercent: number): MpFeeSummary {
  let count = 0;
  let surcharge = 0;
  let fee = 0;
  let result = 0;
  let short = 0;
  let gross = 0;
  for (const o of orders) {
    if (o.mp_net_received === null) continue;
    const total = toCents(o.total);
    const net = toCents(o.mp_net_received);
    const extra = surchargeCents(total, currentPercent);
    count += 1;
    surcharge += extra;
    gross += total + extra;
    fee += total + extra - net;
    result += net - total;
    if (net + 50 < total) short += 1;
  }
  const share = gross > 0 ? fee / gross : null;
  return {
    count,
    surchargeCents: surcharge,
    feeCents: fee,
    resultCents: result,
    shortCount: short,
    feePercent: share === null ? null : Math.round(share * 1000) / 10,
    suggestedPercent: share !== null && share > 0 && share < 0.5 ? Math.ceil((share / (1 - share)) * 1000) / 10 : null,
  };
}

export type MpRunningRow<T extends MpOrder> = { order: T; resultCents: number; runningCents: number };

/** Cada pago con lo que dejó (+ o −) y el acumulado hasta ese pago. Espera los pedidos de más viejo a más nuevo. */
export function runningResult<T extends MpOrder>(orders: T[]): MpRunningRow<T>[] {
  let running = 0;
  const rows: MpRunningRow<T>[] = [];
  for (const o of orders) {
    if (o.mp_net_received === null) continue;
    const resultCents = toCents(o.mp_net_received) - toCents(o.total);
    running += resultCents;
    rows.push({ order: o, resultCents, runningCents: running });
  }
  return rows;
}
