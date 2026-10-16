import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl, getOrderTotals, normalizeWhatsAppNumber } from "@/lib/whatsapp";

describe("normalizeWhatsAppNumber", () => {
  it("acepta números internacionales y limpia símbolos", () => {
    expect(normalizeWhatsAppNumber("+54 9 11 0000-0000")).toBe("5491100000000");
  });
  it("rechaza vacíos, cortos, largos o con 0 inicial", () => {
    expect(normalizeWhatsAppNumber("")).toBeNull();
    expect(normalizeWhatsAppNumber(undefined)).toBeNull();
    expect(normalizeWhatsAppNumber("12345")).toBeNull();
    expect(normalizeWhatsAppNumber("1234567890123456")).toBeNull();
    expect(normalizeWhatsAppNumber("01100000000")).toBeNull();
  });
});

describe("totales del pedido", () => {
  const lines = [
    { name: "Perfume & Co #1", size: "100 ml", quantity: 2, unitCents: 2000000, magazineUnitCents: 2500000 },
    { name: "Jabón", size: null, quantity: 1, unitCents: 300000, magazineUnitCents: 300000 },
  ];

  it("calcula total y ahorro", () => {
    expect(getOrderTotals(lines)).toEqual({ totalCents: 4300000, savingsCents: 1000000, units: 3 });
  });
});

describe("enlace de WhatsApp", () => {
  it("codifica el mensaje para URL", () => {
    const message = "Hola Mariel\n¿Me ayudás con el pedido #1 & el 2?";
    const url = buildWhatsAppUrl("5491100000000", message);
    expect(url.startsWith("https://wa.me/5491100000000?text=")).toBe(true);
    expect(url.split("?text=")[1]).not.toMatch(/[ \n#&]/);
    expect(new URL(url).searchParams.get("text")).toBe(message);
  });
});
