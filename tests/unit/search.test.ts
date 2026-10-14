import { describe, expect, it } from "vitest";

import { nameSearchPatterns } from "@/lib/search";

describe("nameSearchPatterns", () => {
  it("separa por palabras para encontrarlas en cualquier orden", () => {
    expect(nameSearchPatterns("  Ekos  crema ")).toEqual(["%_k_s%", "%cr_m_%"]);
  });

  it("acepta palabras con o sin tilde", () => {
    const [pattern] = nameSearchPatterns("jabón");
    expect(pattern).toBe("%j_b_n%");
    expect(nameSearchPatterns("jabon")).toEqual([pattern]);
  });

  it("escapa los comodines que escribe la persona", () => {
    expect(nameSearchPatterns("100%")).toEqual(["%100\\%%"]);
  });

  it("devuelve una lista vacía si no hay texto", () => {
    expect(nameSearchPatterns("   ")).toEqual([]);
  });
});
