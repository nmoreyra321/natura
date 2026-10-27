import { describe, expect, it } from "vitest";

import { meaningfulWords, nameSearchPatterns } from "@/lib/search";

/** Simula el operador imatch (~*) de la base. */
const matches = (name: string, q: string) =>
  nameSearchPatterns(q).every((p) => new RegExp(p, "i").test(name));

describe("nameSearchPatterns", () => {
  it("separa por palabras para encontrarlas en cualquier orden", () => {
    expect(nameSearchPatterns("  Ekos  crema ")).toHaveLength(2);
    expect(matches("Crema corporal Ekos Maracuyá", "ekos crema")).toBe(true);
  });

  it("acepta palabras con o sin tilde y con ñ", () => {
    expect(matches("Jabón líquido Tododia", "jabon")).toBe(true);
    expect(matches("Jabon liquido", "jabón")).toBe(true);
    expect(matches("Mamá y Bebé colonia niño", "nino bebe")).toBe(true);
  });

  it("la vocal no coincide con cualquier letra (humor no encuentra 'splash Mora')", () => {
    expect(matches("Body splash Mora Roja y Jabuticaba Tododia", "humor")).toBe(false);
    expect(matches("Eau de Toilette Humor Beija Eu", "humor")).toBe(true);
  });

  it("escapa caracteres especiales que escribe la persona", () => {
    expect(matches("Humor +optimismo 25 ml", "+optimismo")).toBe(true);
    expect(matches("Kit (regalo)", "(regalo)")).toBe(true);
    expect(() => nameSearchPatterns("a[b")).not.toThrow();
    expect(matches("crema", "c.ema")).toBe(false);
  });

  it("devuelve una lista vacía si no hay texto", () => {
    expect(nameSearchPatterns("   ")).toEqual([]);
  });
});

describe("meaningfulWords", () => {
  it("ignora el relleno si hay palabras que identifican el producto", () => {
    expect(meaningfulWords("Kaiak eau de parfum")).toEqual(["kaiak"]);
    expect(meaningfulWords("humor para ella")).toEqual(["humor", "ella"]);
  });
  it("si todo es relleno, deja las palabras como estaban", () => {
    expect(meaningfulWords("eau de parfum")).toEqual(["eau", "de", "parfum"]);
    expect(meaningfulWords("perfumes")).toEqual(["perfumes"]);
  });
});
