import { describe, expect, it } from "vitest";

import { shippingCostCents } from "@/lib/delivery";
import { formatARS } from "@/lib/format";
import { getPriceInfo, planMagazinePriceUpdate, salePriceFromDiscount, surchargeCents, toCents } from "@/lib/pricing";

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
    expect(formatARS(1250000)).toBe("$ 12.500");
    expect(formatARS(99)).toBe("$ 0,99");
    expect(formatARS(123456789)).toBe("$ 1.234.567,89");
  });
});

describe("planMagazinePriceUpdate", () => {
  it("si el especial era igual al de revista, acompaña el precio nuevo", () => {
    expect(planMagazinePriceUpdate({ magazine_price: "16300.00", sale_price: "16300.00", is_offer: false }, 17900)).toEqual({
      magazine_price: 17900,
      sale_price: 17900,
      is_offer: false,
    });
  });

  it("mantiene un precio especial propio", () => {
    expect(planMagazinePriceUpdate({ magazine_price: 20000, sale_price: 15000, is_offer: true }, 22000)).toEqual({
      magazine_price: 22000,
      sale_price: 15000,
      is_offer: true,
    });
  });

  it("deja de ser oferta si el especial ya no es menor que el de revista", () => {
    expect(planMagazinePriceUpdate({ magazine_price: 20000, sale_price: 15000, is_offer: true }, 14000).is_offer).toBe(false);
  });
});

describe("salePriceFromDiscount", () => {
  it("aplica el % sobre el precio de revista", () => {
    expect(salePriceFromDiscount(30000, 25)).toBe(22500);
    expect(salePriceFromDiscount("18500.00", 10)).toBe(16650);
  });

  it("redondea hacia abajo para no mostrar menos descuento del elegido", () => {
    const sale = salePriceFromDiscount(27990, 25);
    expect(sale).toBe(20992);
    expect(getPriceInfo(27990, sale).discountPercent).toBe(25);
  });

  it("0% deja el precio de revista y rechaza valores inválidos", () => {
    expect(salePriceFromDiscount(30000, 0)).toBe(30000);
    expect(salePriceFromDiscount(30000, 100)).toBeNaN();
    expect(salePriceFromDiscount(30000, -5)).toBeNaN();
    expect(salePriceFromDiscount(0, 10)).toBeNaN();
  });
});

describe("descuento sin errores de coma flotante", () => {
  it("29% sobre $100 se muestra como 29%", () => {
    expect(getPriceInfo(100, salePriceFromDiscount(100, 29)).discountPercent).toBe(29);
  });
});

describe("surchargeCents", () => {
  it("redondea hacia arriba al peso (nunca queda en cero ni de menos)", () => {
    expect(surchargeCents(500, 8.3)).toBe(100);
    expect(surchargeCents(1_117_500, 8.3)).toBe(92_800);
  });
  it("calcula el recargo redondeado al peso", () => {
    expect(surchargeCents(2_000_000, 8)).toBe(160_000);
    expect(surchargeCents(1_999_900, 7.5)).toBe(150_000);
  });
  it("sin recargo devuelve 0", () => {
    expect(surchargeCents(2_000_000, 0)).toBe(0);
    expect(surchargeCents(0, 8)).toBe(0);
  });
});


describe("costo del envío (% de la compra)", () => {
  it("redondea hacia arriba a $100", () => {
    expect(shippingCostCents(35_000_00, 5)).toBe(1_800_00);
    expect(shippingCostCents(40_000_00, 7)).toBe(2_800_00);
    expect(shippingCostCents(35_100_00, 9)).toBe(3_200_00);
  });
  it("0 % o compra vacía: sin costo", () => {
    expect(shippingCostCents(35_000_00, 0)).toBe(0);
    expect(shippingCostCents(0, 5)).toBe(0);
  });
});
