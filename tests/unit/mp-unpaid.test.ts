import { describe, expect, it } from "vitest";

import { canCustomerCancel, isUnpaidMercadoPago, type TrackingOrder } from "@/lib/order-tracking";

const base: TrackingOrder = {
  status: "pending",
  payment_method: "mercadopago",
  payment_status: "pending",
  mp_payment_id: null,
  amount_paid: 0,
  total: 5000,
  payment_reported_at: null,
  payment_rejection: null,
};

describe("pedido de Mercado Pago que nunca se pagó", () => {
  it("se puede cancelar y volver a pagar", () => {
    expect(isUnpaidMercadoPago(base)).toBe(true);
    expect(canCustomerCancel(base)).toBe(true);
  });
  it("con un pago registrado (por ejemplo Rapipago en proceso) ya no", () => {
    const withPayment = { ...base, mp_payment_id: "123" };
    expect(isUnpaidMercadoPago(withPayment)).toBe(false);
    expect(canCustomerCancel(withPayment)).toBe(false);
  });
  it("aprobado: no se cancela desde la tienda", () => {
    const paid = { ...base, payment_status: "approved", mp_payment_id: "123" };
    expect(isUnpaidMercadoPago(paid)).toBe(false);
    expect(canCustomerCancel(paid)).toBe(false);
  });
});
