import { describe, expect, it } from "vitest";

import { formatARS } from "@/lib/format";
import { getPriceInfo, toCents } from "@/lib/pricing";

describe("getPriceInfo", () => {
  it("calcula descuento, ahorro y porcentaje", () => {
    const info = getPriceInfo(25000, 20000);
    expect(info.hasDiscount).toBe(true);
    expect(info.savingsCents).toBe(500000);
    expect(info.discountPercent).toBe(20);
  });

  it("redondea el porcentaje hacia abajo (nunca promete de más)", () => {
    expect(getPriceInfo(3000, 2001).discountPercent).toBe(33);
    expect(getPriceInfo("12999.99", "10000.00").discountPercent).toBe(23);
  });

  it("no muestra descuento si los precios son iguales", () => {
    const info = getPriceInfo(15000, 15000);
    expect(info.hasDiscount).toBe(false);
    expect(info.savingsCents).toBe(0);
    expect(info.discountPercent).toBe(0);
  });

  it("no muestra descuento si el precio de venta es mayor", () => {
    expect(getPriceInfo(10000, 12000).hasDiscount).toBe(false);
  });

  it("no divide por cero ni acepta precios no positivos", () => {
    expect(getPriceInfo(0, 100).hasDiscount).toBe(false);
    expect(getPriceInfo(-100, 50).hasDiscount).toBe(false);
    expect(getPriceInfo(100, 0).hasDiscount).toBe(false);
    expect(getPriceInfo(Number.NaN, 10).discountPercent).toBe(0);
  });

  it("evita errores de punto flotante", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(getPriceInfo(19.99, 9.99).savingsCents).toBe(1000);
  });
});

describe("formatARS", () => {
  it("usa formato argentino", () => {
    expect(formatARS(1250000)).toBe("$ 12.500,00");
    expect(formatARS(99)).toBe("$ 0,99");
    expect(formatARS(123456789)).toBe("$ 1.234.567,89");
  });
});
