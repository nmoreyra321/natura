import { describe, expect, it } from "vitest";

import {
  canReportPayment,
  needsPaymentReview,
  normalizeOrderCode,
  owedOf,
  paymentState,
  trackingSteps,
  type TrackingOrder,
} from "@/lib/order-tracking";

const base: TrackingOrder = {
  status: "pending",
  payment_method: "transferencia",
  payment_status: null,
  amount_paid: 0,
  total: 20000,
  payment_reported_at: null,
  payment_rejection: null,
};

describe("paymentState", () => {
  it("transferencia sin avisar: falta pagar", () => {
    expect(paymentState(base)).toBe("unpaid");
    expect(canReportPayment(base)).toBe(true);
  });

  it("avisó que transfirió: queda por revisar", () => {
    const o = { ...base, payment_reported_at: "2026-10-15T12:00:00Z" };
    expect(paymentState(o)).toBe("review");
    expect(needsPaymentReview(o)).toBe(true);
    expect(canReportPayment(o)).toBe(false);
  });

  it("rechazado: puede volver a avisar", () => {
    const o = { ...base, payment_rejection: "No llegó la transferencia" };
    expect(paymentState(o)).toBe("rejected");
    expect(canReportPayment(o)).toBe(true);
  });

  it("aprobado: pagado y sin revisar", () => {
    const o = { ...base, payment_status: "approved", amount_paid: 20000 };
    expect(paymentState(o)).toBe("paid");
    expect(needsPaymentReview(o)).toBe(false);
  });

  it("pagó una parte", () => {
    const o = { ...base, amount_paid: 5000 };
    expect(paymentState(o)).toBe("partial");
    expect(owedOf(o)).toBe(1_500_000);
  });

  it("un pedido cancelado no se revisa", () => {
    expect(needsPaymentReview({ ...base, status: "cancelled", payment_reported_at: "2026-10-15T12:00:00Z" })).toBe(false);
  });

  it("efectivo se paga al recibir", () => {
    expect(paymentState({ ...base, payment_method: "efectivo" })).toBe("on_delivery");
    expect(canReportPayment({ ...base, payment_method: "efectivo" })).toBe(false);
  });

  it("Mercado Pago rechazado", () => {
    expect(paymentState({ ...base, payment_method: "mercadopago", payment_status: "rejected" })).toBe("failed");
    expect(paymentState({ ...base, payment_method: "mercadopago", payment_status: "pending" })).toBe("unpaid");
  });
});

describe("trackingSteps", () => {
  it("transferencia tiene el paso del pago", () => {
    const steps = trackingSteps({ ...base, status: "confirmed", payment_status: "approved" });
    expect(steps.map((s) => s.label)).toEqual(["Pedido recibido", "Pago aprobado", "Pedido confirmado", "Entregado"]);
    expect(steps.map((s) => s.done)).toEqual([true, true, true, false]);
  });

  it("efectivo no tiene paso de pago", () => {
    expect(trackingSteps({ ...base, payment_method: "efectivo" }).map((s) => s.label)).toEqual([
      "Pedido recibido",
      "Pedido confirmado",
      "Entregado",
    ]);
  });
});

describe("normalizeOrderCode", () => {
  it("acepta el código como lo escriba la clienta", () => {
    expect(normalizeOrderCode("nm-1a2b3c")).toBe("NM-1A2B3C");
    expect(normalizeOrderCode(" NM 1A2B3C ")).toBe("NM-1A2B3C");
    expect(normalizeOrderCode("1a2b3c")).toBe("NM-1A2B3C");
    expect(normalizeOrderCode("hola")).toBeNull();
  });
});
