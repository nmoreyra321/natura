import { describe, expect, it } from "vitest";

import { clubOrderNote, loyaltyStatus, summarizeClub } from "@/lib/loyalty";

const order = (phone: string, status = "confirmed", name = "Ana", at = "2026-10-01T10:00:00Z", total = 25000) => ({
  customer_name: name,
  customer_phone: phone,
  status,
  created_at: at,
  total,
  payment_status: "approved" as string | null,
});

describe("loyaltyStatus", () => {
  it("cuenta cuánto falta para el regalo", () => {
    expect(loyaltyStatus(3, 0)).toEqual({ purchases: 3, pending: 0, progress: 3, left: 2 });
  });
  it("con 5 compras le toca un regalo, y deja de tocarle cuando se entrega", () => {
    expect(loyaltyStatus(5, 0).pending).toBe(1);
    expect(loyaltyStatus(5, 1).pending).toBe(0);
    expect(loyaltyStatus(11, 1)).toMatchObject({ pending: 1, progress: 1, left: 4 });
  });
});

describe("summarizeClub", () => {
  it("solo suman los pedidos pagados completos", () => {
    const orders = [order("5491122223333"), { ...order("5491122223333"), payment_status: null }];
    expect(summarizeClub(orders, [], 0)[0].purchases).toBe(1);
  });

  it("solo suman los pedidos que llegan al monto mínimo", () => {
    const orders = [order("5491122223333"), order("5491122223333", "delivered", "Ana", "2026-10-02T10:00:00Z", 19999.99)];
    expect(summarizeClub(orders, [], 20000)[0].purchases).toBe(1);
    expect(summarizeClub(orders, [], 0)[0].purchases).toBe(2);
  });

  it("agrupa por teléfono, solo cuenta pedidos confirmados o entregados y pone primero a quien le toca regalo", () => {
    const orders = [
      ...Array.from({ length: 5 }, () => order("5491122223333", "delivered", "Laura")),
      order("5491144445555"),
      order("5491144445555", "pending"),
      order("5491144445555", "cancelled"),
      order("011 4444-5555", "confirmed", "Ana", "2026-10-05T10:00:00Z"),
      order("", "confirmed", "Sin teléfono"),
    ];
    const club = summarizeClub(orders, []);
    expect(club.map((m) => [m.name, m.purchases, m.pending])).toEqual([
      ["Laura", 5, 1],
      ["Ana", 2, 0],
    ]);
  });
});

describe("clubOrderNote: por qué un pedido no suma al Club", () => {
  const min = 3_000_000; // $30.000
  const base = { linked: false, signedInNow: false, productsCents: 3_500_000, minCents: min };

  it("con cuenta y llega al mínimo: no hay nada que explicar", () => {
    expect(clubOrderNote({ ...base, linked: true, signedInNow: true })).toBeNull();
  });
  it("con cuenta pero no llega al mínimo: el motivo es el mínimo", () => {
    expect(clubOrderNote({ ...base, linked: true, signedInNow: true, productsCents: 500 })).toBe("below");
  });
  it("sin cuenta y no llega al mínimo: faltan las dos cosas", () => {
    expect(clubOrderNote({ ...base, productsCents: 500 })).toBe("below_no_account");
  });
  it("hoy con sesión iniciada pero el pedido es de antes y no llega al mínimo: el motivo es el mínimo, no la sesión", () => {
    expect(clubOrderNote({ ...base, signedInNow: true, productsCents: 500 })).toBe("below");
  });
  it("hoy con sesión iniciada, llega al mínimo, pero lo hizo antes de entrar", () => {
    expect(clubOrderNote({ ...base, signedInNow: true })).toBe("before_login");
  });
  it("sin cuenta y llega al mínimo: solo falta la cuenta", () => {
    expect(clubOrderNote(base)).toBe("no_account");
  });
  it("justo en el mínimo cuenta", () => {
    expect(clubOrderNote({ ...base, linked: true, productsCents: min })).toBeNull();
  });
  it("sin mínimo configurado, cualquier compra llega", () => {
    expect(clubOrderNote({ ...base, linked: true, productsCents: 100, minCents: 0 })).toBeNull();
  });
});
