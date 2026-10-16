import { describe, expect, it } from "vitest";

import { detectTopics, firstName, suggestReply } from "@/lib/review-reply";

describe("ideas de respuesta para reseñas", () => {
  it("usa el primer nombre con mayúscula", () => {
    expect(firstName("giselle arroyo")).toBe("Giselle");
    const r = suggestReply({ name: "Alicia Fernandez", rating: 5, comment: "Hermosos productos y muy buenos precioss" });
    expect(r).toContain("Alicia");
  });

  it("reconoce de qué habla la reseña", () => {
    expect(detectTopics("Hermosos productos y muy buenos precios")).toEqual(expect.arrayContaining(["precio", "producto"]));
    expect(detectTopics("Muy conforme con el método de compra")).toContain("compra");
  });

  it("a una reseña mala no le contesta como si fuera buena", () => {
    for (let i = 0; i < 20; i++) {
      const r = suggestReply({ name: "Ana", rating: 1, comment: "Llegó tarde y roto" });
      expect(r).toMatch(/WhatsApp/);
      expect(r).not.toMatch(/próximo pedido|Nos alegra/);
    }
  });

  it("no repite la anterior y evita frases ya usadas", () => {
    const review = { name: "Ana", rating: 5, comment: "Excelente atención" };
    const a = suggestReply(review);
    for (let i = 0; i < 20; i++) expect(suggestReply(review, { previous: a })).not.toBe(a);
    const others = Array.from({ length: 3 }, () => suggestReply(review));
    const variety = new Set(Array.from({ length: 30 }, () => suggestReply(review, { others })));
    expect(variety.size).toBeGreaterThan(5);
  });
});
