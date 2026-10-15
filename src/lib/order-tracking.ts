import { toCents } from "./pricing";

/** Datos del pedido que hacen falta para saber en qué está (tienda y panel). */
export type TrackingOrder = {
  status: string;
  payment_method: string;
  payment_status: string | null;
  amount_paid: number | string;
  total: number | string;
  payment_reported_at: string | null;
  payment_rejection: string | null;
};

/**
 * En qué está el pago:
 * - paid: pagado por completo.
 * - review: la clienta avisó que transfirió y falta que la administradora lo revise.
 * - rejected: la administradora no encontró el pago (la clienta ve el motivo).
 * - partial: pagó una parte.
 * - unpaid: todavía no pagó (transferencia o Mercado Pago).
 * - failed: Mercado Pago no cobró.
 * - on_delivery: efectivo, se paga al recibir.
 */
export type PaymentState = "paid" | "review" | "rejected" | "partial" | "unpaid" | "failed" | "on_delivery";

export function paymentState(o: TrackingOrder): PaymentState {
  if (o.payment_status === "approved") return "paid";
  if (o.payment_method === "mercadopago") {
    return ["rejected", "cancelled", "refunded", "charged_back"].includes(o.payment_status ?? "") ? "failed" : "unpaid";
  }
  if (o.payment_method === "transferencia") {
    if (o.payment_reported_at) return "review";
    if (o.payment_rejection) return "rejected";
  }
  if (toCents(o.amount_paid) > 0) return "partial";
  return o.payment_method === "transferencia" ? "unpaid" : "on_delivery";
}

/** true si es una transferencia que la clienta avisó y hay que revisar (para el panel). */
export function needsPaymentReview(o: TrackingOrder): boolean {
  return o.status !== "cancelled" && paymentState(o) === "review";
}

/** true si la clienta puede avisar (otra vez) que transfirió. */
export function canReportPayment(o: TrackingOrder): boolean {
  if (o.status === "cancelled" || o.payment_method !== "transferencia") return false;
  const s = paymentState(o);
  return s === "unpaid" || s === "rejected" || s === "partial";
}

export type TrackingStep = { label: string; done: boolean };

/** Pasos que ve la clienta en la página de su pedido. */
export function trackingSteps(o: TrackingOrder): TrackingStep[] {
  const confirmed = o.status === "confirmed" || o.status === "delivered";
  const steps: TrackingStep[] = [{ label: "Pedido recibido", done: true }];
  if (o.payment_method !== "efectivo") steps.push({ label: "Pago aprobado", done: paymentState(o) === "paid" });
  steps.push({ label: "Pedido confirmado", done: confirmed });
  steps.push({ label: "Entregado", done: o.status === "delivered" });
  return steps;
}

/** Lo que falta pagar, en centavos. */
export function owedOf(o: TrackingOrder): number {
  return Math.max(0, toCents(o.total) - toCents(o.amount_paid));
}

/** Código como lo escribe la clienta ("nm 1a2b3c", "1A2B3C") → "NM-1A2B3C". */
export function normalizeOrderCode(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^NM/, "");
  return /^[0-9A-F]{6}$/.test(clean) ? `NM-${clean}` : null;
}
