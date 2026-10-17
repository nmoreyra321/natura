import { describe, expect, it } from "vitest";

import { canCustomerCancel } from "@/lib/order-tracking";

const base = {
  status: "pending",
  payment_method: "efectivo",
  payment_status: null,
  amount_paid: 0,
  total: 10000,
  payment_reported_at: null,
  payment_rejection: null,
};

describe("canCustomerCancel", () => {
  it("deja cancelar un pedido pendiente sin pagos", () => {
    expect(canCustomerCancel(base)).toBe(true);
    expect(canCustomerCancel({ ...base, payment_method: "transferencia", payment_rejection: "No lo encontré" })).toBe(true);
  });
  it("no deja si ya está confirmado, entregado o cancelado", () => {
    for (const status of ["confirmed", "delivered", "cancelled"]) expect(canCustomerCancel({ ...base, status })).toBe(false);
  });
  it("no deja si hay plata de por medio (parcial, avisada o en proceso)", () => {
    expect(canCustomerCancel({ ...base, amount_paid: 5000 })).toBe(false);
    expect(canCustomerCancel({ ...base, payment_reported_at: "2026-10-15T10:00:00Z" })).toBe(false);
    // En proceso de verdad = Mercado Pago ya registró un pago (tiene número). Sin número, nunca se pagó y sí se puede cancelar.
    expect(canCustomerCancel({ ...base, payment_method: "mercadopago", payment_status: "pending", mp_payment_id: "123" })).toBe(false);
    expect(canCustomerCancel({ ...base, payment_status: "approved" })).toBe(false);
  });
});
