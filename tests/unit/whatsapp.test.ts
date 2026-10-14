import { describe, expect, it } from "vitest";

import { buildOrderMessage, buildWhatsAppUrl, getOrderTotals, normalizeWhatsAppNumber } from "@/lib/whatsapp";

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

describe("mensaje de pedido", () => {
  const lines = [
    { name: "Perfume & Co #1", size: "100 ml", quantity: 2, unitCents: 2000000, magazineUnitCents: 2500000 },
    { name: "Jabón", size: null, quantity: 1, unitCents: 300000, magazineUnitCents: 300000 },
  ];

  it("calcula total y ahorro", () => {
    expect(getOrderTotals(lines)).toEqual({ totalCents: 4300000, savingsCents: 1000000, units: 3 });
  });

  it("incluye productos, cantidades, subtotales, total y aclara que es pendiente", () => {
    const msg = buildOrderMessage(lines);
    expect(msg).toContain("1. Perfume & Co #1 (100 ml)");
    expect(msg).toContain("2 x $ 20.000,00 = $ 40.000,00");
    expect(msg).toContain("1 x $ 3.000,00 = $ 3.000,00");
    expect(msg).toContain("*Total: $ 43.000,00*");
    expect(msg).toContain("Ahorro frente a precio de revista: $ 10.000,00");
    expect(msg).toMatch(/espera de tu confirmación/);
  });

  it("codifica el mensaje para URL", () => {
    const url = buildWhatsAppUrl("5491100000000", buildOrderMessage(lines));
    expect(url.startsWith("https://wa.me/5491100000000?text=")).toBe(true);
    expect(url.split("?text=")[1]).not.toMatch(/[ \n#&]/);
    const text = new URL(url).searchParams.get("text");
    expect(text).toBe(buildOrderMessage(lines));
  });
});

describe("buildOrderMessage con número de pedido", () => {
  it("incluye el número y el nombre cuando están", () => {
    const msg = buildOrderMessage(
      [{ name: "Crema", quantity: 1, unitCents: 100000, magazineUnitCents: 100000 }],
      undefined,
      { orderNumber: 42, customerName: "  Ana " },
    );
    expect(msg.startsWith("¡Hola Mariel! Soy Ana y quiero hacer este pedido:")).toBe(true);
    expect(msg).toContain("*Pedido N.º 42*");
  });
});

describe("buildOrderMessage con forma de pago", () => {
  const lines = [{ name: "Ekos Maracuyá", size: "200 ml", quantity: 1, unitCents: 1_000_000, magazineUnitCents: 1_000_000 }];

  it("indica la forma de pago elegida", () => {
    expect(buildOrderMessage(lines, undefined, { paymentMethod: "efectivo" })).toContain("Forma de pago: Efectivo");
  });

  it("si ya pagó con Mercado Pago lo dice y no pide confirmar el pago", () => {
    const msg = buildOrderMessage(lines, undefined, { orderNumber: 7, paid: true });
    expect(msg).toContain("Ya lo pagué con Mercado Pago");
    expect(msg).toContain("Pedido N.º 7");
    expect(msg).not.toContain("confirmación de stock, pago");
  });
});

describe("buildOrderMessage por transferencia", () => {
  it("avisa que manda el comprobante", () => {
    const lines = [{ name: "Tododia", quantity: 2, unitCents: 500_000, magazineUnitCents: 500_000 }];
    expect(buildOrderMessage(lines, undefined, { paymentMethod: "transferencia" })).toContain(
      "Forma de pago: Transferencia (te mando el comprobante)",
    );
  });
});
