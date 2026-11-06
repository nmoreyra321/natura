import { describe, expect, it } from "vitest";

import { mlDescription, mlIssues, mlPrice, mlTitle } from "@/lib/mercadolibre";

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
  it("suma el recargo y redondea hacia arriba a múltiplos de 10", () => {
    expect(mlPrice(10000, 0)).toBe(10000);
    expect(mlPrice(10000, 15)).toBe(11500);
    expect(mlPrice(9990, 15)).toBe(11490);
    expect(mlPrice(8333, 13)).toBe(9420);
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
