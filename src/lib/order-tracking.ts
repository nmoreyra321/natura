import { toCents } from "./pricing";

/** Datos del pedido que hacen falta para saber en qué está (tienda y panel). */
export type TrackingOrder = {
  status: string;
  payment_method: string;
  payment_status: string | null;
  /** Número de pago de Mercado Pago: si no hay, la clienta nunca llegó a pagar. */
  mp_payment_id?: string | null;
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
  const delivered = o.status === "delivered";
  if (o.payment_method === "efectivo") {
    return [
      { label: "Pedido recibido", done: true },
      { label: "Pedido confirmado", done: o.status === "confirmed" || delivered },
      { label: "Entregado", done: delivered },
    ];
  }
  // Pago online: al confirmar el pago, el pedido queda confirmado y reservado en el mismo paso.
  const state = paymentState(o);
  const paid = state === "paid" || delivered;
  return [
    { label: "Pedido recibido", done: true },
    { label: "Verificando pago", done: paid || state === "review" },
    { label: "Pago confirmado", done: paid },
    { label: "Entregado", done: delivered },
  ];
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

/**
 * La clienta puede cancelar sola su pedido solo si Natu Mariel todavía no lo confirmó y no hay
 * ningún pago (ni parcial, ni avisado, ni en proceso). Si hay plata de por medio, lo resuelve con
 * Natu Mariel por WhatsApp, así nunca se pierde un pago.
 */
export function canCustomerCancel(o: TrackingOrder): boolean {
  if (o.status !== "pending") return false;
  if (toCents(o.amount_paid) > 0) return false;
  if (o.payment_reported_at) return false;
  if (o.payment_status && !["rejected", "cancelled"].includes(o.payment_status)) {
    // Mercado Pago sin ningún pago registrado: la clienta volvió sin pagar, así que puede cancelar.
    const neverPaid = o.payment_method === "mercadopago" && o.payment_status === "pending" && !o.mp_payment_id;
    if (!neverPaid) return false;
  }
  return true;
}

/** true si es un pedido de Mercado Pago que la clienta empezó pero nunca pagó (puede pagar de nuevo o cambiar). */
export function isUnpaidMercadoPago(o: TrackingOrder): boolean {
  return (
    o.status === "pending" &&
    o.payment_method === "mercadopago" &&
    !o.mp_payment_id &&
    (o.payment_status === null || o.payment_status === "pending")
  );
}

/** true si la clienta todavía no pagó nada y puede elegir otra forma de pago para el mismo pedido. */
export function canChangePayment(o: TrackingOrder): boolean {
  return (
    o.status === "pending" &&
    o.payment_status !== "approved" &&
    !o.mp_payment_id &&
    !o.payment_reported_at &&
    toCents(o.amount_paid) <= 0
  );
}
