import { describe, expect, it } from "vitest";

import { formatPhone, groupDebts, owedCents, toWhatsAppPhone, type DebtOrderRow } from "@/lib/debts";

const row = (o: Partial<DebtOrderRow>): DebtOrderRow => ({
  id: o.id ?? "1",
  code: o.code ?? "NM-AAAAAA",
  customer_name: o.customer_name ?? null,
  customer_phone: o.customer_phone ?? null,
  total: o.total ?? 10000,
  amount_paid: o.amount_paid ?? 0,
  created_at: o.created_at ?? "2026-10-01T10:00:00Z",
  payment_note: o.payment_note ?? null,
  payment_method: o.payment_method ?? "transferencia",
  payment_status: o.payment_status ?? null,
  status: o.status ?? "confirmed",
});

describe("owedCents", () => {
  it("calcula lo que falta y ignora pagados, cancelados y Mercado Pago", () => {
    expect(owedCents(row({ total: 81000, amount_paid: 30000 }))).toBe(5_100_000);
    expect(owedCents(row({ payment_status: "approved" }))).toBe(0);
    expect(owedCents(row({ status: "cancelled" }))).toBe(0);
    expect(owedCents(row({ payment_method: "mercadopago" }))).toBe(0);
  });
});

describe("groupDebts", () => {
  it("agrupa por clienta sin importar tildes ni mayúsculas y ordena por deuda", () => {
    const groups = groupDebts([
      row({ id: "a", customer_name: "Laura Gómez", total: 10000, created_at: "2026-10-05T10:00:00Z" }),
      row({ id: "b", customer_name: "laura gomez ", total: 5000, amount_paid: 1000, created_at: "2026-10-01T10:00:00Z", customer_phone: "5491122223333" }),
      row({ id: "c", customer_name: "Ana", total: 30000 }),
      row({ id: "d", total: 2000 }),
      row({ id: "e", customer_name: "Ana", payment_status: "approved" }),
    ]);
    expect(groups.map((g) => [g.name, g.owedCents])).toEqual([
      ["Ana", 3_000_000],
      ["Laura Gómez", 1_400_000],
      [null, 200_000],
    ]);
    const laura = groups[1];
    expect(laura.since).toBe("2026-10-01T10:00:00Z");
    expect(laura.phone).toBe("5491122223333");
    expect(laura.orders.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

describe("toWhatsAppPhone", () => {
  it("normaliza celulares argentinos", () => {
    expect(toWhatsAppPhone("11 2345-6789")).toBe("5491123456789");
    expect(toWhatsAppPhone("011 15 2345 6789")).toBe("5491123456789");
    expect(toWhatsAppPhone("+54 9 351 234 5678")).toBe("5493512345678");
    expect(toWhatsAppPhone("0351 15 234 5678")).toBe("5493512345678");
    expect(toWhatsAppPhone("123")).toBeNull();
    expect(toWhatsAppPhone("")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("muestra el teléfono guardado de forma legible", () => {
    expect(formatPhone("5491125030882")).toBe("+54 9 11 2503-0882");
    expect(formatPhone("1125030882")).toBe("1125030882");
  });
});

describe("groupDebts con mismo nombre", () => {
  it("separa dos clientas con el mismo nombre y distinto teléfono", () => {
    const groups = groupDebts([
      { id: "a", code: "NM-A", customer_name: "Laura", customer_phone: "5491111111111", total: 1000, amount_paid: 0, created_at: "2026-10-01T10:00:00Z", payment_note: null, payment_method: "efectivo", payment_status: null, status: "confirmed" },
      { id: "b", code: "NM-B", customer_name: "Laura", customer_phone: "5492222222222", total: 2000, amount_paid: 0, created_at: "2026-10-02T10:00:00Z", payment_note: null, payment_method: "efectivo", payment_status: null, status: "confirmed" },
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("toWhatsAppPhone sin código de área", () => {
  it("rechaza un celular escrito con 15 pero sin código de área", () => {
    expect(toWhatsAppPhone("15 2345-6789")).toBeNull();
    expect(toWhatsAppPhone("011 15 2345-6789")).toBe("5491123456789");
    expect(toWhatsAppPhone("549112345678")).toBeNull();
  });
});
