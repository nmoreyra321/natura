import { describe, expect, it } from "vitest";

import { mlDescription, mlFixedFee, mlIssues, mlNet, mlPrice, mlTitle } from "@/lib/mercadolibre";

describe("mlTitle", () => {
  it("agrega la marca si falta", () => {
    expect(mlTitle("Kaiak Femenino 100 ml")).toEqual({ title: "Kaiak Femenino 100 ml Natura", shortened: false });
  });
  it("no repite la marca", () => {
    expect(mlTitle("Natura Humor Liberta").title).toBe("Natura Humor Liberta");
  });
  it("acorta a 60 letras sin cortar palabras y deja la marca", () => {
    const r = mlTitle("Body splash Ciruela y Flor de Vainilla Tododia 200 ml edición especial de verano");
    expect(r.shortened).toBe(true);
    expect(r.title.length).toBeLessThanOrEqual(60);
    expect(r.title.endsWith(" Natura")).toBe(true);
    expect(r.title).not.toMatch(/\bveran\b/);
  });
});

describe("mlPrice", () => {
  it("calcula el precio para que, descontada la comisión, te quede tu precio", () => {
    expect(mlPrice(10000, 0)).toBe(10000);
    expect(mlPrice(10000, 15)).toBe(11770);
    expect(mlPrice(9990, 15)).toBe(11760);
    expect(mlPrice(8333, 13)).toBe(9580);
    // Descontando el 15% al precio nuevo, queda al menos el precio original.
    expect(mlPrice(10000, 15) * 0.85).toBeGreaterThanOrEqual(10000);
  });
});

describe("mlDescription", () => {
  it("saca enlaces y mails y deja texto simple", () => {
    expect(mlDescription("Línea Kaiak\n\n  Visitá https://natura.com y escribí a yo@mail.com \nFresca")).toBe("Línea Kaiak\nVisitá y escribí a\nFresca");
  });
});

describe("mlIssues", () => {
  it("avisa lo que falta", () => {
    expect(mlIssues({ shortened: true, photos: [], description: "", naturaSku: null })).toContain("Sin fotos");
    expect(mlIssues({ shortened: false, photos: ["https://x/a.jpg"], description: "x".repeat(40), naturaSku: "NATARG-1" })).toBe("");
  });
});

describe("mlPrice con costo fijo y envío", () => {
  const tiers = [
    { upTo: 15000, fee: 1115 },
    { upTo: 25000, fee: 2300 },
    { upTo: 33000, fee: 2810 },
  ];
  it("nunca te deja menos que tu precio", () => {
    for (const sale of [1000, 5000, 9990, 12000, 13000, 19000, 21000, 24000, 27000, 30000, 45000, 90000]) {
      for (const shipping of [0, 3500]) {
        const p = mlPrice(sale, 16, { fixedTiers: tiers, shipping });
        expect(mlNet(p, 16, { fixedTiers: tiers, shipping })).toBeGreaterThanOrEqual(sale);
        // Y no se pasa de más: $10 menos ya no alcanza.
        const q = p - 10;
        expect(q * 0.84 - mlFixedFee(q, tiers) - shipping).toBeLessThan(sale);
      }
    }
  });
  it("suma el costo fijo en los productos baratos", () => {
    expect(mlPrice(10000, 16, { fixedTiers: tiers })).toBe(13240); // (10000 + 1115) / 0.84
    expect(mlPrice(40000, 16, { fixedTiers: tiers })).toBe(mlPrice(40000, 16));
  });
  it("si conviene, salta al tramo sin costo fijo", () => {
    // 26000 / 0.84 = 30953 cae en el tramo de 2810: conviene $33.000, que ya no paga costo fijo.
    const p = mlPrice(26000, 16, { fixedTiers: tiers });
    expect(p).toBe(33000);
  });
});
